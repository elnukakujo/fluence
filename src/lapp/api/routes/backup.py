"""
Database backup management endpoints.

Provides API endpoints for:
- Creating manual backups
- Restoring from backups
- Listing available backups
- Getting backup statistics
- Downloading a backup file (admin)
- Deleting old backups
"""
import logging
from flask import Blueprint, jsonify, request, current_app, send_from_directory
from ...core.auth import admin_required
from datetime import datetime

logger = logging.getLogger(__name__)

bp = Blueprint('backup', __name__, url_prefix='/api/backup')

@bp.route('/create', methods=['POST'])
@admin_required
def create_backup():
    """
    Create a manual database backup.
    ---
    tags:
        - Backup
    responses:
        201:
            description: Backup created successfully
            schema:
                type: object
                properties:
                    success:
                        type: boolean
                    backup_file:
                        type: string
        500:
            description: Backup creation failed
            schema:
                type: object
                properties:
                    success:
                        type: boolean
                    error:
                        type: string
    """
    try:
        backup_mgr = current_app.backup_manager
        backup_path = backup_mgr.create_backup()
        
        if backup_path:
            # Get file size
            size_mb = round(backup_path.stat().st_size / (1024 * 1024), 2)
            
            return jsonify({
                'success': True,
                'backup_file': backup_path.name,
                'path': str(backup_path),
                'size_mb': size_mb,
                'created_at': datetime.now().isoformat()
            }), 201
        else:
            return jsonify({
                'success': False,
                'error': 'Backup creation failed'
            }), 500
            
    except Exception as e:
        logger.error(f"Backup creation error: {e}", exc_info=True)
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@bp.route('/restore', methods=['POST'])
@admin_required
def restore_backup():
    """
    Restore database from a backup.
    ---
    tags:
        - Backup
    parameters:
        - in: body
          name: body
          schema:
            type: object
            properties:
                backup_file:
                    type: string
                    description: Name of the backup file to restore from. If omitted, restores from the latest backup.
    responses:
        200:
            description: Restore successful
            schema:
                type: object
                properties:
                    success:
                        type: boolean
                    restored_from:
                        type: string
                    message:
                        type: string
        404:
            description: Backup file not found
            schema:
                type: object
                properties:
                    success:
                        type: boolean
                    error:
                        type: string
        500:
            description: Restore failed
    """
    try:
        backup_mgr = current_app.backup_manager
        
        # Get optional backup file from request
        data = request.get_json() or {}
        backup_file = data.get('backup_file')
        
        # Construct full path if backup_file specified
        backup_path = None
        if backup_file:
            backup_path = backup_mgr.backup_dir / backup_file
            
            if not backup_path.exists():
                return jsonify({
                    'success': False,
                    'error': f'Backup file not found: {backup_file}'
                }), 404
        
        # Restore from specified backup or latest
        success = backup_mgr.restore_backup(backup_path)
        
        if success:
            restored_from = backup_path.name if backup_path else backup_mgr.get_latest_backup().name
            
            return jsonify({
                'success': True,
                'restored_from': restored_from,
                'message': 'Database restored successfully'
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Restore failed'
            }), 500
            
    except Exception as e:
        logger.error(f"Restore error: {e}", exc_info=True)
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@bp.route('/list', methods=['GET'])
@admin_required
def list_backups():
    """
    List all available backups with details.
    tags:
        - Backup
    responses:
        200:
            description: List of backups
            schema:
                type: object
                properties:
                    total:
                        type: integer
                    backups:
                        type: array
                        items:
                            type: object
                            properties:
                                filename:
                                    type: string
                                size_mb:
                                    type: number
                                size_bytes:
                                    type: integer
                                created_at:
                                    type: string
                                age_days:
                                    type: integer
                                is_latest:
                                    type: boolean
        500:
            description: Failed to list backups
            schema:
                type: object
                properties:
                    success:
                        type: boolean
                    error:
                        type: string
    """
    try:
        backup_mgr = current_app.backup_manager
        backups = backup_mgr.list_backups()
        
        backup_list = []
        for backup_path in backups:
            stat = backup_path.stat()
            created_dt = backup_mgr.backup_timestamp(backup_path)
            age_days = (datetime.now() - created_dt).days
            
            backup_list.append({
                'filename': backup_path.name,
                'size_mb': round(stat.st_size / (1024 * 1024), 2),
                'size_bytes': stat.st_size,
                'created_at': created_dt.isoformat(),
                'age_days': age_days,
                'is_latest': backup_path == backup_mgr.get_latest_backup()
            })
        
        return jsonify({
            'total': len(backup_list),
            'backups': backup_list
        })
        
    except Exception as e:
        logger.error(f"List backups error: {e}", exc_info=True)
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@bp.route('/info', methods=['GET'])
@admin_required
def backup_info():
    """
    Get backup system information and statistics.
    ---
    tags:
        - Backup
    responses:
        200:
            description: Backup information
            schema:
                type: object
                properties:
                    total_backups:
                        type: integer
                    max_backups:
                        type: integer
                    total_size_mb:
                        type: number
                    latest_backup_age_hours:
                        type: number
        500:
            description: Failed to get backup info
            schema:
                type: object
                properties:
                    success:
                        type: boolean
                    error:
                        type: string
    """
    try:
        backup_mgr = current_app.backup_manager
        info = backup_mgr.get_stats()
        
        # Add additional calculated fields
        backups = backup_mgr.list_backups()
        
        # Calculate total size
        total_size = sum(b.stat().st_size for b in backups)
        info['total_size_mb'] = round(total_size / (1024 * 1024), 2)
        
        # Add latest backup age
        latest = backup_mgr.get_latest_backup()
        if latest:
            created_dt = backup_mgr.backup_timestamp(latest)
            age_hours = (datetime.now() - created_dt).total_seconds() / 3600
            info['latest_backup_age_hours'] = round(age_hours, 1)
        else:
            info['latest_backup_age_hours'] = None
        
        return jsonify(info)
        
    except Exception as e:
        logger.error(f"Backup info error: {e}", exc_info=True)
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@bp.route('/download/<backup_file>', methods=['GET'])
@admin_required
def download_backup(backup_file: str):
    """
    Download a backup dump (admin only).
    ---
    tags:
        - Backup
    parameters:
        - in: path
          name: backup_file
          required: true
          type: string
    responses:
        200:
            description: The backup file
        400:
            description: Invalid backup filename
        403:
            description: Admin access required
        404:
            description: Backup file not found
    """
    backup_dir = current_app.backup_manager.backup_dir
    if not backup_file.startswith('backup_') or not backup_file.endswith('.dump'):
        return jsonify({'success': False, 'error': 'Invalid backup filename'}), 400
    if not (backup_dir / backup_file).is_file():
        return jsonify({'success': False, 'error': f'Backup file not found: {backup_file}'}), 404
    # send_from_directory also rejects path traversal.
    return send_from_directory(backup_dir, backup_file, as_attachment=True)


@bp.route('/delete/<backup_file>', methods=['DELETE'])
@admin_required
def delete_backup(backup_file: str):
    """
    Delete a specific backup file.
    ---
    tags:
        - Backup
    parameters:
        - in: path
          name: backup_file
          required: true
          type: string
          description: Name of the backup file to delete
          example: backup_fluence_dev_20260101_120000.dump
    responses:
        200:
            description: Backup deleted successfully
            schema:
                type: object
                properties:
                    success:
                        type: boolean
                    message:
                        type: string
                    deleted_file:
                        type: string
        400:
            description: Bad request (e.g., trying to delete the only backup)
            schema:
                type: object
                properties:
                    success:
                        type: boolean
                    error:
                        type: string
        404:
            description: Backup file not found
            schema:
                type: object
                properties:
                    success:
                        type: boolean
                    error:
                        type: string
        500:
            description: Failed to delete backup
            schema:
                type: object
                properties:
                    success:
                        type: boolean
                    error:
                        type: string
    """
    try:
        backup_mgr = current_app.backup_manager
        backup_path = backup_mgr.backup_dir / backup_file
        
        # Security check: ensure it's a backup file
        if not backup_file.startswith('backup_') or not backup_file.endswith('.dump'):
            return jsonify({
                'success': False,
                'error': 'Invalid backup filename'
            }), 400
        
        if not backup_path.exists():
            return jsonify({
                'success': False,
                'error': f'Backup file not found: {backup_file}'
            }), 404
        
        # Don't allow deleting the latest backup if it's the only one
        backups = backup_mgr.list_backups()
        if len(backups) == 1:
            return jsonify({
                'success': False,
                'error': 'Cannot delete the only backup'
            }), 400
        
        # Delete the file
        backup_path.unlink()
        logger.info(f"Deleted backup: {backup_file}")
        
        return jsonify({
            'success': True,
            'message': 'Backup deleted successfully',
            'deleted_file': backup_file
        })
        
    except Exception as e:
        logger.error(f"Delete backup error: {e}", exc_info=True)
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@bp.route('/cleanup', methods=['POST'])
@admin_required
def cleanup_old_backups():
    """
    Manually trigger cleanup of old backups.
    Removes backups exceeding the configured max_backups limit.
    ---
    tags:
        - Backup
    responses:
        200:
            description: Cleanup completed successfully
            schema:
                type: object
                properties:
                    success:
                        type: boolean
                    deleted_count:
                        type: integer
                    remaining_count:
                        type: integer
                    message:
                        type: string
        500:
            description: Cleanup failed
            schema:
                type: object
    """
    try:
        backup_mgr = current_app.backup_manager
        
        # Get count before cleanup
        before_count = len(backup_mgr.list_backups())
        
        # Trigger cleanup
        backup_mgr.cleanup_old_backups()
        
        # Get count after cleanup
        after_count = len(backup_mgr.list_backups())
        deleted_count = before_count - after_count
        
        return jsonify({
            'success': True,
            'deleted_count': deleted_count,
            'remaining_count': after_count,
            'message': 'Cleanup completed'
        })
        
    except Exception as e:
        logger.error(f"Cleanup error: {e}", exc_info=True)
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500