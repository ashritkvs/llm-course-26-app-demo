"""
core/pdf_converter.py - Convert HTML reports to PDF
Used for Telegram bot report delivery
"""
import os
import sys
from pathlib import Path
from typing import Optional
import logging

logger = logging.getLogger('pdf_converter')

class PDFConverter:
    """Convert HTML reports to PDF format"""

    def __init__(self):
        self.pdfkit = None
        self.wkhtmltopdf_configured = False
        self._init_pdfkit()

    def _init_pdfkit(self):
        """Initialize pdfkit with platform-specific wkhtmltopdf path"""
        try:
            import pdfkit

            # Configure wkhtmltopdf path based on platform
            if sys.platform == 'win32':
                # Windows: Check common installation paths
                wkhtmltopdf_paths = [
                    r'C:\Program Files\wkhtmltopdf\bin\wkhtmltopdf.exe',
                    r'C:\Program Files (x86)\wkhtmltopdf\bin\wkhtmltopdf.exe',
                    os.path.expandvars(r'%LOCALAPPDATA%\wkhtmltopdf\bin\wkhtmltopdf.exe'),
                ]

                for path in wkhtmltopdf_paths:
                    if os.path.exists(path):
                        config = pdfkit.configuration(wkhtmltopdf=path)
                        self.pdfkit = pdfkit
                        self.wkhtmltopdf_configured = True
                        logger.info(f"wkhtmltopdf found at: {path}")
                        break

                if not self.wkhtmltopdf_configured:
                    # Try using system PATH
                    try:
                        pdfkit.configuration()
                        self.pdfkit = pdfkit
                        self.wkhtmltopdf_configured = True
                        logger.info("wkhtmltopdf found in system PATH")
                    except Exception:
                        logger.warning("wkhtmltopdf not found in system PATH")
            else:
                # Linux/Mac: Usually in PATH
                try:
                    pdfkit.configuration()
                    self.pdfkit = pdfkit
                    self.wkhtmltopdf_configured = True
                    logger.info("wkhtmltopdf found in system PATH")
                except Exception:
                    logger.warning("wkhtmltopdf not found. Install with: sudo apt-get install wkhtmltopdf")

        except ImportError:
            logger.warning("pdfkit not installed. Install with: pip install pdfkit")
        except Exception as e:
            logger.error(f"Error initializing pdfkit: {e}")

    def convert_html_to_pdf(self, html_path: str, output_path: Optional[str] = None) -> Optional[str]:
        """
        Convert HTML file to PDF

        Args:
            html_path: Path to HTML file
            output_path: Optional output PDF path (default: same name with .pdf extension)

        Returns:
            Path to PDF file if successful, None otherwise
        """
        if not self.pdfkit or not self.wkhtmltopdf_configured:
            logger.error("PDF conversion not available - wkhtmltopdf not configured")
            return None

        html_file = Path(html_path)
        if not html_file.exists():
            logger.error(f"HTML file not found: {html_path}")
            return None

        if output_path is None:
            output_path = str(html_file.with_suffix('.pdf'))

        try:
            options = {
                'page-size': 'A4',
                'margin-top': '10mm',
                'margin-right': '10mm',
                'margin-bottom': '10mm',
                'margin-left': '10mm',
                'encoding': 'UTF-8',
                'no-outline': None,
                'enable-local-file-access': None,
                'disable-smart-shrinking': None,
            }

            self.pdfkit.from_file(html_path, output_path, options=options)
            logger.info(f"Converted {html_path} to {output_path}")
            return output_path

        except Exception as e:
            logger.exception(f"Failed to convert HTML to PDF: {e}")
            return None

    def convert_html_string_to_pdf(self, html_content: str, output_path: str) -> Optional[str]:
        """
        Convert HTML string to PDF

        Args:
            html_content: HTML content as string
            output_path: Output PDF path

        Returns:
            Path to PDF file if successful, None otherwise
        """
        if not self.pdfkit or not self.wkhtmltopdf_configured:
            logger.error("PDF conversion not available")
            return None

        try:
            options = {
                'page-size': 'A4',
                'margin-top': '10mm',
                'margin-right': '10mm',
                'margin-bottom': '10mm',
                'margin-left': '10mm',
                'encoding': 'UTF-8',
                'no-outline': None,
            }

            self.pdfkit.from_string(html_content, output_path, options=options)
            logger.info(f"Converted HTML string to {output_path}")
            return output_path

        except Exception as e:
            logger.exception(f"Failed to convert HTML string to PDF: {e}")
            return None

    def is_available(self) -> bool:
        """Check if PDF conversion is available"""
        return self.pdfkit is not None and self.wkhtmltopdf_configured


# Global instance
_converter = None

def get_pdf_converter() -> PDFConverter:
    """Get or create PDF converter instance"""
    global _converter
    if _converter is None:
        _converter = PDFConverter()
    return _converter


def convert_to_pdf(html_path: str, output_path: Optional[str] = None) -> Optional[str]:
    """Convenience function to convert HTML to PDF"""
    converter = get_pdf_converter()
    return converter.convert_html_to_pdf(html_path, output_path)
