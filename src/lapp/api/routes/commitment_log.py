from flask import Blueprint, jsonify, request

import logging

from ...services.data_collection import CommitmentLogService
from ...core.auth import login_required, require_owns, require_write, current_user_id

logger = logging.getLogger(__name__)

commitment_log_bp = Blueprint('commitment_log', __name__, url_prefix='/api/commitment-log')
commitment_log_service = CommitmentLogService()


@commitment_log_bp.route('/<commitment_log_id>', methods=['GET'])
@login_required
def get_commitment_log_by_id(commitment_log_id: str):
    try:
        user_id = current_user_id()

        result = commitment_log_service.get_by_id(
            commitment_log_id=commitment_log_id,
            as_dict=True,
            include_relations=False,
        )

        if not result:
            return jsonify({'error': 'Not found'}), 404

        if result.get('user_id') != user_id:
            return jsonify({'error': 'Forbidden'}), 403

        return jsonify(result)
    except Exception as e:
        logger.error(f"Error fetching commitment log by id: {e}")
        return jsonify({'error': str(e)}), 500


@commitment_log_bp.route('/user/<user_id>/language/<language_id>', methods=['GET'])
@login_required
def get_commitment_log_for_user_language(user_id: str, language_id: str):
    try:
        require_write(language_id)
        result = commitment_log_service.get_for_user(
            user_id=current_user_id(),
            language_id=language_id,
            as_dict=True,
            include_relations=False,
        )
        if result is None:
            return jsonify({'error': 'Not found'}), 404
        return jsonify(result)
    except Exception as e:
        logger.error(f"Error fetching commitment log for user/language: {e}")
        return jsonify({'error': str(e)}), 500


@commitment_log_bp.route('/user/<user_id>', methods=['GET'])
@login_required
def get_all_commitment_logs_for_user(user_id: str):
    try:
        result = commitment_log_service.get_all_for_user(
            user_id=current_user_id(),
            as_dict=True,
            include_relations=False,
        )
        return jsonify(result)
    except Exception as e:
        logger.error(f"Error fetching commitment logs for user: {e}")
        return jsonify({'error': str(e)}), 500
