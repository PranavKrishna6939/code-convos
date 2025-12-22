import sys
import json
import os
from langmem import create_prompt_optimizer
from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI

def main():
    # Read input from stdin
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError:
        print(json.dumps({"error": "Invalid JSON input"}))
        sys.exit(1)

    current_prompt = input_data.get("current_prompt")
    examples = input_data.get("examples", [])
    provider = input_data.get("provider", "openai")
    model_name = input_data.get("model", "gpt-4o")
    temperature = input_data.get("temperature", 0.0)
    
    if not current_prompt:
        print(json.dumps({"error": "Missing current_prompt"}))
        sys.exit(1)

    # Construct trajectories
    trajectories = []
    for ex in examples:
        messages = []
        context = ex.get("context", {})
        
        if context.get("user_before"):
            messages.append({"role": "user", "content": context["user_before"]})
        
        if context.get("assistant"):
            messages.append({"role": "assistant", "content": context["assistant"]})
            
        if context.get("user_after"):
            messages.append({"role": "user", "content": context["user_after"]})
            
        feedback = f"Error: {ex.get('reason', 'Unknown error')}. Suggestion: {ex.get('suggestion', 'No suggestion')}"
        
        if messages:
            trajectories.append((messages, feedback))

    if not trajectories:
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
        
        # Initialize optimizer
        optimizer = create_prompt_optimizer(model)
        
        # Invoke optimizer
        optimizer_result = optimizer.invoke({
            "prompt": current_prompt,
            "trajectories": trajectories
        })
        
        # Output result
        print(json.dumps({"success": True, "optimizedPrompt": optimizer_result}))

    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()
