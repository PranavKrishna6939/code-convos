import sys
import json
import os

try:
    from langchain_core.prompts import ChatPromptTemplate
    from langchain_core.output_parsers import StrOutputParser
    from langchain_core.messages import SystemMessage
    from langchain_openai import ChatOpenAI
    from langchain_google_genai import ChatGoogleGenerativeAI
except ImportError as e:
    print(json.dumps({"error": f"ImportError: {str(e)}. Please ensure all requirements are installed."}))
    sys.exit(1)

def main():
    # Read input from stdin
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError:
        print(json.dumps({"error": "Invalid JSON input"}))
        sys.exit(1)

    current_prompt = input_data.get("current_prompt")
    examples = input_data.get("examples", [])
    provider = input_data.get("provider", "google")
    model_name = input_data.get("model", "gemini-3-flash-preview")
    temperature = input_data.get("temperature", 0.2)
    meta_prompt = input_data.get("meta_prompt", "")
    
    if not current_prompt:
        print(json.dumps({"error": "Missing current_prompt"}))
        sys.exit(1)

    # Check for variable syntax in current prompt
    preserve_syntax_instruction = ""
    if "${" in current_prompt:
        preserve_syntax_instruction = " IMPORTANT: You MUST preserve the ${variable} syntax for all variables. Do NOT change them to {variable}."

    # Construct trajectories
    trajectories_text = ""
    for i, ex in enumerate(examples):
        context = ex.get("context", {})
        
        trajectories_text += f"\n--- Example {i+1} ---\n"
        if context.get("user_before"):
            trajectories_text += f"User: {context['user_before']}\n"
        if context.get("assistant"):
            trajectories_text += f"Assistant: {context['assistant']}\n"
        if context.get("user_after"):
            trajectories_text += f"User: {context['user_after']}\n"
            
        trajectories_text += f"Feedback: Error: {ex.get('reason', 'Unknown error')}. Suggestion: {ex.get('suggestion', 'No suggestion')}\n"

    if not trajectories_text:
        print(json.dumps({"error": "No valid trajectories found from examples"}))
        sys.exit(1)

    try:
        # Initialize model based on provider
        if provider == 'openai':
            if not os.environ.get("OPENAI_API_KEY") and input_data.get("api_key"):
                os.environ["OPENAI_API_KEY"] = input_data.get("api_key")
            model = ChatOpenAI(model=model_name, temperature=temperature)
        elif provider == 'google':
            if not os.environ.get("GOOGLE_API_KEY") and input_data.get("api_key"):
                os.environ["GOOGLE_API_KEY"] = input_data.get("api_key")
            model = ChatGoogleGenerativeAI(model=model_name, temperature=temperature)
        else:
            # Fallback or error
            print(json.dumps({"error": f"Unsupported provider: {provider}"}))
            sys.exit(1)
        
        # Use custom meta prompt if provided, otherwise fallback to a default
        if not meta_prompt:
             print(json.dumps({"error": "Missing meta_prompt in input"}))
             sys.exit(1)

        # Append the preserve syntax instruction if needed
        if preserve_syntax_instruction:
            meta_prompt += "\n" + preserve_syntax_instruction

        prompt_template = ChatPromptTemplate.from_messages([
            SystemMessage(content=meta_prompt),
            ("user", "Current System Prompt:\n{current_prompt}\n\nTrajectories:\n{trajectories}")
        ])

        chain = prompt_template | model | StrOutputParser()
        
        optimizer_result = chain.invoke({
            "current_prompt": current_prompt,
            "trajectories": trajectories_text
        })
        
        # Output result
        print(json.dumps({"success": True, "optimizedPrompt": optimizer_result}))

    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()
