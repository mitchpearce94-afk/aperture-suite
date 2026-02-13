from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
async def health_check():
    return {"status": "healthy", "service": "aperture-suite-ai-engine", "version": "0.1.0"}
