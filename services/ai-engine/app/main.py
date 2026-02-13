from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import process, style, health

app = FastAPI(
    title="Aperture Suite AI Engine",
    description="AI photo processing service for Aperture Suite",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://*.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, tags=["health"])
app.include_router(process.router, prefix="/api/process", tags=["processing"])
app.include_router(style.router, prefix="/api/style", tags=["style"])


@app.on_event("startup")
async def startup():
    print("Aperture Suite AI Engine starting...")


@app.on_event("shutdown")
async def shutdown():
    print("Aperture Suite AI Engine shutting down...")
