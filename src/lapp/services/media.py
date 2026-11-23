import logging
from pathlib import Path
from flask import current_app
from werkzeug.datastructures import FileStorage

from ..utils import MediaFileHandler

logger = logging.getLogger(__name__)

class MediaService:
    """Service class for handling media file operations."""
    
    def __init__(self, media_root: str = None):
        """
        Initialize MediaService.
        
        Args:
            media_root: Path to media root directory. If None, uses Flask config.
        """
        if media_root is None:
            media_root = current_app.config['MEDIA_ROOT']
        self.media_root = Path(media_root)
        self.file_handler = MediaFileHandler(media_root)
    
    def _validate_path(self, filename: str) -> Path:
        """
        Validate and resolve file path to prevent directory traversal.
        
        Args:
            filename: Relative path to media file
            
        Returns:
            Resolved Path object
            
        Raises:
            ValueError: If path is outside media root
        """
        # Prevent absolute paths and normalize the filename
        filename = filename.lstrip("/\\")
        file_path = self.media_root / Path(filename)
        try:
            file_path = file_path.resolve()
            file_path.relative_to(self.media_root.resolve())
            return file_path
        except ValueError:
            raise ValueError(f"Invalid file path: {filename}")
    
    def get_file_path(self, filename: str) -> tuple[Path, Path]:
        """
        Get validated file path and media root.
        
        Returns:
            Tuple of (media_root, file_path)
        """
        file_path = self._validate_path(filename)
        return self.media_root, file_path
    
    def upload_image(self, file: FileStorage, is_temporary: bool = False) -> dict:
        """
        Upload and save an image file.
        
        Args:
            file: Uploaded file object
            is_temporary: Whether the file is temporary
            
        Returns:
            Dict with file info or error
        """
        # Validate file type using handler's method
        if not file.filename or not self.file_handler._is_allowed_image(file.filename):
            from config import Config
            return {'error': f'File type not allowed. Allowed types: {Config.ALLOWED_IMAGE_EXTENSIONS}'}
        
        # Check file size
        file.seek(0, 2)
        file_size = file.tell()
        file.seek(0)
        
        max_size = current_app.config.get('MAX_IMAGE_SIZE', 5 * 1024 * 1024)
        if file_size > max_size:
            max_mb = max_size / (1024 * 1024)
            return {'error': f'File too large. Maximum size: {max_mb}MB'}
        
        # Save using handler's save_image method
        if is_temporary:
            relative_path = self.file_handler.save_temporary_file(file)
        else:
            relative_path = self.file_handler.save_image(file)
        
        if not relative_path:
            return {'error': 'Failed to save file'}
        
        logger.info(f"Uploaded image: {relative_path}")
        
        return {
            'file_path': relative_path,
            'url': f'/{self.media_root.name}/{relative_path}',
            'size_bytes': file_size
        }
    
    def upload_audio(self, file: FileStorage, is_temporary: bool = False) -> dict:
        """
        Upload and save an audio file.
        
        Args:
            file: Uploaded file object
            is_temporary: Whether the file is temporary
            
        Returns:
            Dict with file info or error
        """
        # Validate file type using handler's method
        if not file.filename or not self.file_handler._is_allowed_audio(file.filename):
            from config import Config
            return {'error': f'File type not allowed. Allowed types: {Config.ALLOWED_AUDIO_EXTENSIONS}'}
        
        # Check file size
        file.seek(0, 2)
        file_size = file.tell()
        file.seek(0)
        
        max_size = current_app.config.get('MAX_AUDIO_SIZE', 10 * 1024 * 1024)
        if file_size > max_size:
            max_mb = max_size / (1024 * 1024)
            return {'error': f'File too large. Maximum size: {max_mb}MB'}
        
        # Save using handler's save_audio method
        if is_temporary:
            relative_path = self.file_handler.save_temporary_file(file)
        else:
            relative_path = self.file_handler.save_audio(file)
        
        if not relative_path:
            return {'error': 'Failed to save file'}
        
        logger.info(f"Uploaded audio: {relative_path}")
        
        return {
            'file_path': relative_path,
            'url': f'/{self.media_root.name}/{relative_path}',
            'size_bytes': file_size
        }
    
    def delete_file(self, file_path: str) -> dict:
        """
        Delete a media file.
        
        Args:
            file_path: Relative path to file
            
        Returns:
            Dict with success status or error
        """
        try:
            full_path = self._validate_path(file_path)
        except ValueError as e:
            return {'error': str(e)}
        
        if not full_path.exists():
            return {'error': 'File not found'}
        
        # Delete using handler's delete_file method
        self.file_handler.delete_file(file_path)
        
        logger.info(f"Deleted media file: {file_path}")
        
        return {
            'message': 'File deleted successfully',
            'deleted_file': file_path
        }
    
    def get_file_info(self, filename: str) -> dict:
        """
        Get information about a media file.
        
        Args:
            filename: Relative path to file
            
        Returns:
            Dict with file information
        """
        try:
            file_path = self._validate_path(filename)
        except ValueError:
            return {'error': 'Invalid file path'}
        
        if not file_path.exists():
            return {
                'filename': file_path.name,
                'path': filename,
                'exists': False
            }
        
        # Get file info
        stat = file_path.stat()
        extension = file_path.suffix.lower()
        
        # Determine type using handler's validation methods
        if self.file_handler._is_allowed_image(file_path.name):
            file_type = 'image'
        elif self.file_handler._is_allowed_audio(file_path.name):
            file_type = 'audio'
        else:
            file_type = 'unknown'
        
        return {
            'filename': file_path.name,
            'path': filename,
            'size_mb': round(stat.st_size / (1024 * 1024), 2),
            'size_bytes': stat.st_size,
            'type': file_type,
            'extension': extension,
            'exists': True,
            'url': f'/{self.media_root.name}/{filename}'
        }