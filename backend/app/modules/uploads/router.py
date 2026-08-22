from fastapi import APIRouter, Depends, File, Form, UploadFile

from app.core.deps import get_current_active_user
from app.modules.uploads.service import UploadService

router = APIRouter(prefix="/uploads", tags=["Uploads"])


@router.post("", status_code=201)
@router.post("/", status_code=201, include_in_schema=False)
async def upload_file(
    file: UploadFile = File(...),
    subfolder: str = Form(""),
    _user=Depends(get_current_active_user),
):
    """Store a file and return the URL it can be fetched from.

    Only signed-in staff can upload. Type and size are validated by the service.
    """
    return await UploadService().save(file, subfolder)


@router.delete("", status_code=204)
async def delete_file(file_url: str, _user=Depends(get_current_active_user)):
    """Delete a previously uploaded file by its URL."""
    UploadService().delete(file_url)
