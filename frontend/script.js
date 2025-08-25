const chatBox = document.getElementById('chat');
    const sendBtn = document.querySelector("button");
    let isProcessing = false;

    // Get the textarea element by its ID
const textarea = document.getElementById("prompt");

// Add the 'input' event listener
textarea.addEventListener("input", function () {
  this.style.height = "auto"; // Reset height to recalculate
  const newHeight = this.scrollHeight;
  const maxHeight = 200; // Define your maximum height here

  if (newHeight <= maxHeight) {
    this.style.overflowY = "hidden"; // Hide scrollbar
    this.style.height = newHeight + "px"; // Expand height
  } else {
    this.style.overflowY = "auto"; // Show scrollbar
    this.style.height = maxHeight + "px"; // Lock height
  }
});

// Create typing indicator
function createTypingIndicator() {
    const typingDiv = document.createElement('div');
    typingDiv.classList.add('msg', 'bot', 'typing');
    typingDiv.innerHTML = `
        <div class="typing-dots">
            <span class="dot">.</span>
            <span class="dot">.</span>
            <span class="dot">.</span>
        </div>
    `;
    return typingDiv;
}

// Remove typing indicator
function removeTypingIndicator() {
    const typingIndicator = document.querySelector('.typing');
    if (typingIndicator) {
        typingIndicator.remove();
    }
}

// Language detection function
function detectLanguage(code) {
    code = code.toLowerCase();

    // Python
    if (/^\s*def\s+/.test(code) || code.includes("import ")) return "python";

    // JavaScript
    if (code.includes("console.log") || code.includes("function ") || code.includes("=>")) return "javascript";

    // C
    if (code.includes("#include") || code.includes("int main")) return "c";

    // C++
    if (code.includes("iostream") || code.includes("std::") || code.includes("using namespace")) return "cpp";

    // Java
    if (code.includes("public class") || code.includes("system.out")) return "java";

    // Dart / Flutter
    if (code.includes("import 'package:flutter") || code.includes("void main()") || code.includes("widget build")) return "dart";

    // Go
    if (code.includes("package main") || code.includes("func main()") || code.includes("fmt.")) return "go";

    // Rust
    if (code.includes("fn main()") || code.includes("let mut") || code.includes("println!")) return "rust";

    // Default
    return "python";
}


// Append message to chat
function appendMessage(sender, text) {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('msg', sender);
    msgDiv.textContent = text;
    chatBox.appendChild(msgDiv);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

// Split explanation and code from response
    function splitExplanationAndCode(text) {
    // Look for code blocks marked with ``` or ```
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const codeBlocks = [];
    let match;
    
    while ((match = codeBlockRegex.exec(text)) !== null) {
        const lang = match[1] || 'plaintext';
        const code = match[2].trim();
        codeBlocks.push({ lang, code });
    }
    
    if (codeBlocks.length > 0) {
        // Remove code blocks from text to get explanation
        let explanation = text.replace(codeBlockRegex, '').trim();
        
        // If multiple code blocks, combine them
        if (codeBlocks.length === 1) {
            return {
                explanation: explanation || null,
                code: codeBlocks[0].code,
                lang: codeBlocks[0].lang
            };
        } else {
            // Multiple code blocks - combine them
            const combinedCode = codeBlocks.map(block => 
                `\n// ${block.lang.toUpperCase()}\n${block.code}`
            ).join('\n\n');
            return {
                explanation: explanation || null,
                code: combinedCode,
                lang: 'mixed'
            };
        }
    }
    
    // No code blocks found
    return {
        explanation: text,
        code: null,
        lang: null
    };
}

// Format explanation text with markdown
function formatExplanation(text) {
    if (!text) return '';
    
    // Convert markdown to HTML
    const html = marked.parse(text);
    
    // Apply some basic styling
    return html
        .replace(/<h1>/g, '<h1 style="color: #4FC3F7; margin: 20px 0 15px 0; font-size: 24px;">')
        .replace(/<h2>/g, '<h2 style="color: #4FC3F7; margin: 18px 0 12px 0; font-size: 20px;">')
        .replace(/<h3>/g, '<h3 style="color: #4FC3F7; margin: 16px 0 10px 0; font-size: 18px;">')
        .replace(/<h4>/g, '<h4 style="color: #4FC3F7; margin: 14px 0 8px 0; font-size: 16px;">')
        .replace(/<p>/g, '<p style="margin: 0 0 12px 0; line-height: 1.6;">')
        .replace(/<ul>/g, '<ul style="margin: 10px 0 10px 20px; padding-left: 0;">')
        .replace(/<li>/g, '<li style="margin-bottom: 8px;">')
        .replace(/<strong>/g, '<strong style="color: #FFD700;">')
        .replace(/<em>/g, '<em style="color: #FFB6C1;">');
    }

async function sendMessage() {
    if (isProcessing) return;
    const promptEl = document.getElementById('prompt');
    const text = promptEl.value.trim();
    if (!text) return;
    promptEl.value = "";

    isProcessing = true;
    sendBtn.disabled = true;
    sendBtn.textContent = "Thinking...";
    sendBtn.classList.add('loading');

    appendMessage("user", text);
    
    // Show typing indicator
    const typingIndicator = createTypingIndicator();
    chatBox.appendChild(typingIndicator);
    chatBox.scrollTop = chatBox.scrollHeight;

    try {
        // Add timeout to the fetch request
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minutes timeout
        
        const res = await fetch(`https://codebot-ai.onrender.com/generate?prompt=${encodeURIComponent(text)}`, {
            method: "POST",
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }

        // Remove typing indicator
        removeTypingIndicator();

        // Create bot message container
        const botDiv = document.createElement('div');
        botDiv.classList.add('msg', 'bot');
        botDiv.innerHTML = '<div class="streaming-indicator">🔄 Starting response...</div>';
        chatBox.appendChild(botDiv);
        chatBox.scrollTop = chatBox.scrollHeight;

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let fullText = "";
        let totalChunks = 0;
        const streamStartTime = Date.now(); // Start time for streaming metrics

        // REAL-TIME STREAMING - Display each chunk immediately!
        while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });

    // ✅ detect explicit end marker from backend
    if (chunk.includes("[STREAM_DONE]")) {
        console.log("✅ Stream completed");
        break;
    }

    fullText += chunk;
    totalChunks++;

    // show partial response in real-time
    botDiv.innerHTML = `
        <div class="streaming-indicator">
            🔄 Receiving response... (${totalChunks} chunks, ${fullText.length} chars)
        </div>
        <div class="content">${fullText.replace(/\n/g, '<br>')}</div>
    `;
    chatBox.scrollTop = chatBox.scrollHeight;

    await new Promise(resolve => setTimeout(resolve, 10));
}

        
        // Final display update with proper formatting
        const { explanation, code, lang } = splitExplanationAndCode(fullText);
        
        // Debug logging
        console.log('🔍 Code detection:', { explanation: !!explanation, code: !!code, lang, langType: typeof lang });
        
        if (code) {
            // Ensure lang is a valid string and sanitize it
            const detectedLang = lang || detectLanguage(code);
            const safeLang = (detectedLang && typeof detectedLang === 'string') ? detectedLang.replace(/[^a-zA-Z0-9]/g, '') : 'plaintext';

            console.log('🔍 Language processing:', { original: lang, sanitized: safeLang });
            
            botDiv.innerHTML = `
                ${explanation ? `<div class="explanation">${formatExplanation(explanation)}</div>` : ''}
                <pre data-language="${safeLang}"><code class="language-${safeLang}">${code}</code></pre>
            `;
            
            // Apply syntax highlighting specifically to this code block
            const codeElement = botDiv.querySelector('code');
            if (codeElement) {
                // Apply highlighting immediately without delays
                if (typeof Prism !== 'undefined') {
                    try {
                        Prism.highlightElement(codeElement);
                        console.log('✅ Syntax highlighting applied to:', safeLang);
                    } catch (error) {
                        console.warn('❌ Syntax highlighting failed:', error);
                    }
                } else {
                    console.warn('❌ Prism.js not available for highlighting');
                }
            }
            
            // Also highlight any inline code in the explanation immediately
            const inlineCodeElements = botDiv.querySelectorAll('code:not(pre code)');
            inlineCodeElements.forEach(element => {
                if (element.textContent && element.textContent.length > 0) {
                    if (typeof Prism !== 'undefined') {
                        try {
                            Prism.highlightElement(element);
                        } catch (error) {
                            console.warn('Inline code highlighting failed:', error);
                        }
                    }
                }
            });
        } else {
            botDiv.innerHTML = formatExplanation(fullText);
        }

        // Add copy button if there's code
        if (code) {
            const copyBtn = document.createElement("button");
            copyBtn.textContent = "Copy Code";
            copyBtn.className = "copy-code-btn";
            copyBtn.onclick = () => {
                navigator.clipboard.writeText(code)
                    .then(() => {
                        copyBtn.textContent = "Copied!";
                        copyBtn.classList.add("copied");
                    })
                    .catch(() => alert("Copy failed"));
                setTimeout(() => {
                    copyBtn.textContent = "Copy Code";
                    copyBtn.classList.remove("copied");
                }, 2000);
            };

            botDiv.appendChild(copyBtn);
        }
        
        // Add performance metrics to the response
        const endTime = Date.now();
        const totalTime = endTime - streamStartTime;
        const charsPerSecond = Math.round(fullText.length / (totalTime / 1000));
        
        console.log(`🚀 Response completed in ${totalTime}ms, ${fullText.length} chars, ${charsPerSecond} chars/sec`);
        
        // Show completion message
        const completionDiv = document.createElement('div');
        completionDiv.className = 'completion-indicator';
        completionDiv.innerHTML = `✅ Response completed in ${totalTime}ms (${charsPerSecond} chars/sec)`;
        botDiv.appendChild(completionDiv);
        
    } catch (err) {
        removeTypingIndicator();
        let errorMessage = "❌ Error: ";
        
        if (err.name === 'AbortError') {
            errorMessage += "Request timed out. Please try again.";
        } else if (err.message.includes('Failed to fetch')) {
            errorMessage += "Cannot connect to backend. Please check if the server is running.";
        } else {
            errorMessage += err.message;
        }
        
        appendMessage("bot", errorMessage);
        console.error("Error:", err);
    } finally {
    isProcessing = false;
    sendBtn.disabled = false;
    sendBtn.textContent = "Send";
        sendBtn.classList.remove('loading');
    }
}
let lastScrollTop = 0;
window.addEventListener("scroll", function() {
  const header = document.querySelector(".header");
  let currentScroll = window.pageYOffset || document.documentElement.scrollTop;

  if (currentScroll > lastScrollTop) {
    // scrolling down → hide
    header.classList.add("hidden");
  } else {
    // scrolling up → show
    header.classList.remove("hidden");
  }

  lastScrollTop = currentScroll <= 0 ? 0 : currentScroll; // avoid negative
}, false);


// Handle Enter key in textarea
textarea.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// Test backend connection
async function testConnection() {
    try {
        const res = await fetch('http://127.0.0.1:8000/health', {
            method: 'GET',
            signal: AbortSignal.timeout(5000) // 5 second timeout
        });
        
        if (res.ok) {
            console.log('✅ Backend connection successful');
            return true;
        } else {
            console.log('❌ Backend responded with error:', res.status);
            return false;
        }
    } catch (err) {
        console.log('❌ Backend connection failed:', err.message);
        return false;
    }
}

// Test connection when page loads
window.addEventListener('load', () => {
    testConnection();
    
    // Check if Prism.js is properly loaded
    if (typeof Prism === 'undefined') {
        console.warn('Prism.js not loaded, syntax highlighting will be disabled');
    } else {
        console.log('✅ Prism.js loaded successfully');
    }

    // Add welcome background message
    const welcomeDiv = document.createElement('div');
    welcomeDiv.id = "welcome-overlay";
    welcomeDiv.innerHTML = `
        <div class="welcome-content">
            <h3>🚀 Welcome to CodeBot AI!</h3>
            <p>I'm your intelligent coding assistant powered by Ollama. I can help you with:</p>
            <ul>
                <li><strong>Code Generation</strong> - Write code in any programming language</li>
                <li><strong>Code Explanation</strong> - Understand complex code snippets <em>(in development)</em></li>
                <li><strong>Debugging Help</strong> - Fix issues in your code <em>(in development)</em></li>
                <li><strong>Best Practices</strong> - Learn coding standards and patterns <em>(in development)</em></li>
            </ul>
            <p>Just ask me to write code, explain something, or help you solve a programming problem!</p>
        </div>
    `;
    chatBox.appendChild(welcomeDiv);

    // Disappear after first query
    const inputField = document.getElementById("user-input"); // adjust to your input field id
    const sendBtn = document.getElementById("send-btn"); // adjust to your send button id

    function removeWelcome() {
        const overlay = document.getElementById("welcome-overlay");
        if (overlay) overlay.remove();
        inputField.removeEventListener("keydown", checkEnter);
        sendBtn.removeEventListener("click", removeWelcome);
    }

    function checkEnter(e) {
        if (e.key === "Enter" && inputField.value.trim() !== "") {
            removeWelcome();
        }
    }

    inputField.addEventListener("keydown", checkEnter);
    sendBtn.addEventListener("click", removeWelcome);
});


// Safe Prism highlighting function
function safeHighlight(element) {
    if (typeof Prism !== 'undefined' && element) {
        try {
            Prism.highlightElement(element);
            return true;
        } catch (error) {
            console.warn('Prism highlighting failed:', error);
            return false;
        }
    }
    return false;
}