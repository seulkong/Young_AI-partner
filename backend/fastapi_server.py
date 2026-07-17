import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Setup API clients
import google.generativeai as genai
from anthropic import AsyncAnthropic
from openai import AsyncOpenAI

app = FastAPI(title="AI Orchestration API")

# Initialize SDKs (ensure you have API keys in your .env file)
genai.configure(api_key=os.environ.get("GEMINI_API_KEY", ""))
anthropic_client = AsyncAnthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", ""))
openai_client = AsyncOpenAI(api_key=os.environ.get("OPENAI_API_KEY", ""))

class OrchestrationRequest(BaseModel):
    prompt: str

class OrchestrationResponse(BaseModel):
    original_prompt: str
    step1_gemini_analysis: str
    step2_claude_draft: str
    step3_openai_final: str

@app.post("/orchestrate", response_model=OrchestrationResponse)
async def orchestrate_request(req: OrchestrationRequest):
    if not req.prompt:
        raise HTTPException(status_code=400, detail="Prompt is required")

    # Step 1: Gemini for Intent Analysis
    try:
        model = genai.GenerativeModel('gemini-1.5-flash')
        gemini_response = model.generate_content(
            f"You are an intent analysis expert. Analyze the following user request and provide a clear, structured breakdown of what the user wants to achieve, their underlying goals, and any implicit requirements.\n\nUser Request: {req.prompt}"
        )
        gemini_analysis = gemini_response.text
    except Exception as e:
        gemini_analysis = f"Gemini Error: {str(e)}"

    # Step 2: Claude for Task Planning & Drafting
    try:
        claude_response = await anthropic_client.messages.create(
            model="claude-3-5-sonnet-20240620",
            max_tokens=1024,
            system="You are an expert task planner and drafter. Based on the provided intent analysis, draft a detailed, comprehensive response or action plan to fulfill the user's request.",
            messages=[
                {"role": "user", "content": f"Intent Analysis from previous step:\n{gemini_analysis}\n\nPlease draft the response."}
            ]
        )
        claude_draft = claude_response.content[0].text
    except Exception as e:
        claude_draft = f"Claude Error: {str(e)}"

    # Step 3: OpenAI for Final Polish
    try:
        openai_response = await openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a professional editor. Your job is to take a drafted response and polish it into a highly readable, user-friendly, and engaging final output. Format it beautifully using Markdown."},
                {"role": "user", "content": f"Original Request: {req.prompt}\n\nDrafted Response:\n{claude_draft}\n\nPlease polish this into the final output."}
            ]
        )
        openai_final = openai_response.choices[0].message.content
    except Exception as e:
        openai_final = f"OpenAI Error: {str(e)}"

    return OrchestrationResponse(
        original_prompt=req.prompt,
        step1_gemini_analysis=gemini_analysis,
        step2_claude_draft=claude_draft,
        step3_openai_final=openai_final
    )

@app.get("/")
def read_root():
    return {"message": "AI Orchestration API is running. Send a POST request to /orchestrate"}

if __name__ == "__main__":
    import uvicorn
    # Run the server on port 8000
    uvicorn.run(app, host="0.0.0.0", port=8000)
