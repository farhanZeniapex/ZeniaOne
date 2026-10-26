from io import BytesIO
import zipfile

import pytest

from services.file_security import UnsafeUploadError, scan_document_upload


def _docx(entries):
    stream = BytesIO()
    with zipfile.ZipFile(stream, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, value in entries.items():
            archive.writestr(name, value)
    return stream.getvalue()


def test_valid_docx_structure_is_accepted():
    scan_document_upload(
        "knowledge.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        _docx({"[Content_Types].xml": "types", "word/document.xml": "doc"}),
    )


@pytest.mark.parametrize("entry", ["../escape.txt", "/absolute.txt"])
def test_docx_path_traversal_is_rejected(entry):
    with pytest.raises(UnsafeUploadError, match="unsafe path"):
        scan_document_upload(
            "knowledge.docx",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            _docx({"[Content_Types].xml": "types", "word/document.xml": "doc", entry: "x"}),
        )


def test_docx_macros_are_rejected():
    with pytest.raises(UnsafeUploadError, match="macros"):
        scan_document_upload(
            "knowledge.docx",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            _docx({"[Content_Types].xml": "types", "word/document.xml": "doc", "word/vbaProject.bin": "macro"}),
        )


def test_active_pdf_content_is_rejected():
    with pytest.raises(UnsafeUploadError, match="active content"):
        scan_document_upload("unsafe.pdf", "application/pdf", b"%PDF-1.7 /JavaScript alert")
