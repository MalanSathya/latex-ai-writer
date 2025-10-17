from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import subprocess
import tempfile
import base64
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class LatexRequest(BaseModel):
    latex_content: str

@app.post("/generate-pdf")
async def generate_pdf(request: LatexRequest):
    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            tex_file = os.path.join(tmpdir, "resume.tex")
            
            with open(tex_file, 'w', encoding='utf-8') as f:
                f.write(request.latex_content)
            
            # Run pdflatex
            result = subprocess.run(
                ['pdflatex', '-interaction=nonstopmode', 'resume.tex'],
                cwd=tmpdir,
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode != 0:
                print("pdflatex stdout:", result.stdout)
                print("pdflatex stderr:", result.stderr)
                raise HTTPException(
                    status_code=500,
                    detail=f"LaTeX compilation failed: {result.stderr}"
                )
            
            pdf_file = os.path.join(tmpdir, "resume.pdf")
            
            if not os.path.exists(pdf_file):
                print("pdflatex stdout:", result.stdout)
                print("pdflatex stderr:", result.stderr)
                raise HTTPException(
                    status_code=500,
                    detail="PDF file not generated despite successful compilation."
                )
            
            with open(pdf_file, 'rb') as f:
                pdf_data = f.read()
            
            pdf_base64 = base64.b64encode(pdf_data).decode('utf-8')
            
            return {"pdf": pdf_base64}
            
    except subprocess.TimeoutExpired:
        raise HTTPException(
            status_code=408,
            detail="LaTeX compilation timed out"
        )
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"An unexpected error occurred: {str(e)}"
        )
