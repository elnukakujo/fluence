from flask import Blueprint, request, jsonify, send_from_directory, abort, current_app
from werkzeug.exceptions import HTTPException

import logging
logger = logging.getLogger(__name__)

from ...services import MediaService

bp = Blueprint('media', __name__)

# Required because MediaService depends on current_app context which may not be available at import time
def get_media_service() -> MediaService:
    """Get MediaService instance with current app config."""
    return MediaService(current_app.config['MEDIA_ROOT'])

@bp.route('/media/<path:filename>', methods=['GET'])
@bp.route('/media_dev/<path:filename>', methods=['GET'])
@bp.route('/media_test/<path:filename>', methods=['GET'])
def serve_media(filename: str):
    """
    Serve media files (images, audio).
    ---
    tags:
        - Media
    parameters:
        - in: path
          name: filename
          schema:
            type: string
          required: true
          description: Relative path to the media file
          example: images/cat.jpeg
    responses:
        200:
            description: Media file served successfully
            content:
                application/octet-stream:
                    schema:
                        type: string
                        format: binary
        403:
            description: Forbidden - Invalid file path
        404:
            description: Not Found - File does not exist
    """
    try:
        media_root, file_path = get_media_service().get_file_path(filename)
        
        if not file_path.exists():
            logger.warning(f"Media file not found: {filename}")
            abort(404)
        
        return send_from_directory(media_root, filename, as_attachment=False)

    except HTTPException:
        raise
    except ValueError as e:
        logger.warning(f"Invalid path attempt: {filename}")
        abort(403)
    except Exception as e:
        logger.error(f"Error serving media: {e}", exc_info=True)
        abort(500)


@bp.route('/media/upload/image', methods=['POST'])
def upload_image():
    """
    Upload an image file.
    ---
    tags:
        - Media
    requestBody:
        required: true
        content:
            multipart/form-data:
                schema:
                    type: object
                    properties:
                        file:
                            type: string
                            format: binary
                            description: The image file to upload
                        temporary:
                            type: boolean
                            description: Whether the file is temporary (optional)
                            example: false
    responses:
        201:
            description: Image uploaded successfully
            content:
                application/json:
                    schema:
                        type: object
                        properties:
                            success:
                                type: boolean
                                example: true
                            file_path:
                                type: string
                                description: Relative path to the uploaded image
                                example: images/abc123def456.jpeg
                            url:
                                type: string
                                description: URL to access the uploaded image
                                example: /media/images/abc123def456.jpeg
        400:
            description: Bad Request - Invalid file or parameters
        500:
            description: Internal Server Error
    """
    try:
        if 'file' not in request.files:
            return jsonify({'success': False, 'error': 'No file provided'}), 400
        
        file = request.files['file']
        is_temporary = request.form.get('temporary', 'false').lower() == 'true'
        
        if file.filename == '':
            return jsonify({'success': False, 'error': 'No file selected'}), 400
        
        result = get_media_service().upload_image(file, is_temporary)
        
        if 'error' in result:
            return jsonify({'success': False, 'error': result['error']}), 400
        
        return jsonify({'success': True, **result}), 201
            
    except Exception as e:
        logger.error(f"Image upload error: {e}", exc_info=True)
        return jsonify({'success': False, 'error': str(e)}), 500


@bp.route('/media/upload/audio', methods=['POST'])
def upload_audio():
    """
    Upload an audio file.
    ---
    tags:
        - Media
    requestBody:
        required: true
        content:
            multipart/form-data:
                schema:
                    type: object
                    properties:
                        file:
                            type: string
                            format: binary
                            description: The audio file to upload
                        temporary:
                            type: boolean
                            description: Whether the file is temporary (optional)
                            example: false
    responses:
        201:
            description: Audio uploaded successfully
            content:
                application/json:
                    schema:
                        type: object
                        properties:
                            success:
                                type: boolean
                                example: true
                            file_path:
                                type: string
                                description: Relative path to the uploaded audio
                                example: audio/abc123def456.mp3
                            url:
                                type: string
                                description: URL to access the uploaded audio
                                example: /media/audio/abc123def456.mp3
        400:
            description: Bad Request - Invalid file or parameters
        500:
            description: Internal Server Error
    """
    try:
        if 'file' not in request.files:
            return jsonify({'success': False, 'error': 'No file provided'}), 400
        
        file = request.files['file']
        is_temporary = request.form.get('temporary', 'false').lower() == 'true'
        
        if file.filename == '':
            return jsonify({'success': False, 'error': 'No file selected'}), 400
        
        result = get_media_service().upload_audio(file, is_temporary)
        
        if 'error' in result:
            return jsonify({'success': False, 'error': result['error']}), 400
        
        return jsonify({'success': True, **result}), 201
            
    except Exception as e:
        logger.error(f"Audio upload error: {e}", exc_info=True)
        return jsonify({'success': False, 'error': str(e)}), 500


@bp.route('/media/delete/', methods=['DELETE'])
def delete_media():
    """
    Delete a media file.
    ---
    tags:
        - Media
    parameters:
        - in: body
          name: file_path
          schema:
            type: object
            properties:
                file_path:
                    type: string
                    description: Relative path to the media file to delete
                    example: images/abc123def456.jpeg
                    required: true
    responses:
        200:
            description: Media file deleted successfully
            content:
                application/json:
                    schema:
                        type: object
                        properties:
                            success:
                                type: boolean
                                example: true
                            message:
                                type: string
                                example: File deleted successfully
                            deleted_file:
                                type: string
                                description: Relative path to the deleted file
                                example: images/abc123def456.jpeg
        400:
            description: Bad Request - Invalid file path
        404:
            description: Not Found - File does not exist
        500:
            description: Internal Server Error
    """
    try:
        data = request.get_json()
        if not data or 'file_path' not in data:
            return jsonify({'success': False, 'error': 'file_path is required'}), 400

        result = get_media_service().delete_file(data['file_path'])
        
        if 'error' in result:
            status_code = 404 if result['error'] == 'File not found' else 400
            return jsonify({'success': False, 'error': result['error']}), status_code
        
        return jsonify({'success': True, **result})
        
    except Exception as e:
        logger.error(f"Delete media error: {e}", exc_info=True)
        return jsonify({'success': False, 'error': str(e)}), 500


@bp.route('/media/info/<path:filename>', methods=['GET'])
def media_info(filename: str):
    """
    Get information about a media file.
    
    Example:
        GET /media/info/images/cat.jpeg
        
        Response:
        {
            "filename": "cat.jpeg",
            "path": "images/cat.jpeg",
            "size_mb": 0.45,
            "size_bytes": 471859,
            "type": "image",
            "extension": ".jpeg",
            "exists": true
        }
    """
    try:
        result = get_media_service().get_file_info(filename)
        
        if 'error' in result:
            abort(403)
        
        if not result.get('exists'):
            return jsonify(result), 404

        return jsonify(result)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Media info error: {e}", exc_info=True)
        return jsonify({'success': False, 'error': str(e)}), 500