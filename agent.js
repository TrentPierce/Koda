const { GoogleGenerativeAI } = require("@google/generative-ai");

class Agent {
    constructor(guestWebContents, uiWebContents) {
        this.guestWebContents = guestWebContents;
        this.uiWebContents = uiWebContents;
        this.active = false;
        this.goal = "";

        if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY.length < 10) {
            this.log("⚠️ ERROR: Invalid or missing GEMINI_API_KEY in .env file.");
            this.active = false;
        }

        // Initialize Gemini
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
        // Note: 'gemini-2.5-flash' might not exist yet. Defaulting to 'gemini-1.5-flash' if 2.5 fails is recommended,
        // but we will keep the user's setting.
        this.model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        this.startTime = 0;
        this.apiCalls = 0;
        this.totalTokens = 0;
    }

    log(message) {
        // Log to terminal
        console.log(`[Agent] ${message}`);
        // Log to UI Window
        if (!this.uiWebContents.isDestroyed()) {
            this.uiWebContents.send('agent-log', message);
        }
    }

    sendStats() {
        if (!this.uiWebContents.isDestroyed()) {
            const duration = Math.floor((Date.now() - this.startTime) / 1000);
            const minutes = Math.floor(duration / 60).toString().padStart(2, '0');
            const seconds = (duration % 60).toString().padStart(2, '0');

            this.uiWebContents.send('agent-stats', {
                time: `${minutes}:${seconds}`,
                apiCalls: this.apiCalls,
                tokens: this.totalTokens
            });
        }
    }

    async start(goal) {
        if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY.length < 10) {
            this.log("⚠️ Cannot start: API Key invalid. Please check .env file.");
            return;
        }
        this.active = true;
        this.goal = goal;
        this.startTime = Date.now();
        this.apiCalls = 0;
        this.totalTokens = 0;

        this.log(`Received goal: ${goal}`);
        this.loop();
    }

    stop() {
        this.active = false;
        this.log("Stopping agent Loop.");
        if (!this.uiWebContents.isDestroyed()) {
            this.uiWebContents.send('agent-stopped');
        }
    }

    async loop() {
        if (!this.active) return;

        // Safety check
        if (this.guestWebContents.isDestroyed()) {
            this.active = false;
            return;
        }

        try {
            // 1. Wait for page to be ready (rudimentary check)
            if (this.guestWebContents.isLoading()) {
                this.log("Waiting for page load...");
                // Simple wait
                await new Promise(r => setTimeout(r, 2000));
            }

            this.log("📸 Capturing state...");

            // 2. Capture State (DOM + Screenshot) used from the Guest
            const simplifiedDOM = await this.getSimplifiedDOM();
            const screenshot = await this.guestWebContents.capturePage();
            const base64Image = screenshot.toJPEG(80).toString('base64');

            // 3. Think (Gemini)
            this.log("🧠 Thinking...");
            this.sendStats();
            const actionPlan = await this.askGemini(this.goal, simplifiedDOM, base64Image);

            if (!this.active) return;

            // 4. Act
            await this.executeAction(actionPlan);
            this.sendStats();

            // 5. Wait/Loop
            if (actionPlan.action !== 'done') {
                await new Promise(r => setTimeout(r, 3000));
                this.loop();
            } else {
                this.log("🎉 Goal achieved (according to agent).");
                this.stop();
            }

        } catch (error) {
            this.log(`❌ Error in loop: ${error.message}`);
            console.error(error);
            this.stop();
        }
    }

    async getSimplifiedDOM() {
        // Script to tag elements and extract minimal info
        const script = `
        (function() {
            // Expanded selector to catch more interactive/content elements
            const elements = document.querySelectorAll('a, button, input, textarea, select, [role="button"], [role="link"], [role="checkbox"], [role="radio"], [role="option"], [onclick], label, h1, h2, h3, h4, .modal, .popup, [aria-label*="close" i], [class*="close" i]');
            const lines = [];
            
            elements.forEach(el => {
                // Determine visibility roughly (and skip tiny hidden ones)
                const rect = el.getBoundingClientRect();
                if (rect.width < 5 || rect.height < 5 || rect.top < 0 || rect.top > window.innerHeight) return;
                
                // Skip if fully obscured (simple check)
                const style = window.getComputedStyle(el);
                if (style.visibility === 'hidden' || style.opacity === '0' || style.display === 'none') return;

                // Assign ID
                if (!el.hasAttribute('data-agent-id')) {
                    el.setAttribute('data-agent-id', Math.floor(Math.random() * 1000000).toString());
                }
                const agentId = el.getAttribute('data-agent-id');
                
                // Get text context - prioritize distinct labels
                let text = el.innerText || el.value || el.getAttribute('aria-label') || el.title || el.placeholder || "";
                text = text.replace(/\\s+/g, ' ').trim().substring(0, 100);

                const tag = el.tagName.toLowerCase();
                const type = el.type ? \`type="\${el.type}"\` : "";
                const role = el.getAttribute('role') ? \`role="\${el.getAttribute('role')}"\` : "";
                const checked = el.checked ? 'CHECKED' : '';
                
                // Only include if it has semantic value (text, ID, or specific input type)
                if (text || tag === 'input' || tag === 'select' || tag === 'textarea' || role) {
                    lines.push(\`<\${tag} \${type} \${role} \${checked} data-agent-id="\${agentId}" text="\${text}" />\`);
                }
            });
            return lines.join('\\n');
        })();
        `;

        return await this.guestWebContents.executeJavaScript(script);
    }

    async askGemini(goal, dom, base64Image) {
        this.apiCalls++;
        this.sendStats();

        const prompt = `
        You are a browser automation agent.
        User Goal: "${goal}"
        
        Here is the simplified HTML of interactive elements on the screen:
        ${dom}
        
        Analyze the screenshot and the HTML.
        Decide the single next best action to achieve the goal.
        
        Supported actions:
        - "click": Click an element. Requires "selector".
        - "type": Type text into an input. Requires "selector" and "text".
        - "scroll": Scroll down.
        - "navigate": Go to a URL. Requires "url".
        - "done": Goal is achieved.
        - "wait": if page works.
        
        Return ONLY a JSON object. No markdown formatting.
        Schema:
        {
            "action": "click" | "type" | "scroll" | "done" | "navigate",
            "selector": "[data-agent-id='...']",
            "text": "text to type if typing",
            "url": "full url if navigating",
            "reason": "short explanation"
        }
        `;

        const imagePart = {
            inlineData: {
                data: base64Image,
                mimeType: "image/jpeg",
            },
        };

        const result = await this.model.generateContent([prompt, imagePart]);
        const response = await result.response;

        // Track usage if available
        if (response.usageMetadata) {
            this.totalTokens += (response.usageMetadata.totalTokenCount || 0);
            this.sendStats();
        }

        const text = response.text();

        const cleanJSON = text.replace(/```json/g, '').replace(/```/g, '').trim();

        try {
            this.log(`🤖 Plan: ${cleanJSON}`);
            return JSON.parse(cleanJSON);
        } catch (e) {
            this.log("Failed to parse Gemini JSON: " + text);
            return { action: "wait", reason: "JSON parse error" };
        }
    }

    async executeAction(plan) {
        if (plan.action === "done") return;

        this.log(`👉 Performing: ${plan.action} on ${plan.selector || plan.url || 'page'}`);

        if (plan.action === "navigate" && plan.url) {
            let url = plan.url;
            if (!url.startsWith('http')) url = 'https://' + url;
            this.log(`🌐 Navigating to ${url}...`);
            await this.guestWebContents.loadURL(url);
        } else if (plan.action === "click" && plan.selector) {
            await this.guestWebContents.executeJavaScript(`
                (function() {
                    let selector = "${plan.selector}";
                    // If Gemini returns just the ID number or a bracket selector, handle it
                    if (!selector.includes('[') && !selector.includes('#') && !selector.includes('.')) {
                        selector = \`[data-agent-id='\${selector}']\`;
                    }
                    
                    const el = document.querySelector(selector);
                    if (el) {
                        // Simulate full mouse interaction
                        const opts = { bubbles: true, cancelable: true, view: window };
                        el.dispatchEvent(new MouseEvent('mousedown', opts));
                        el.dispatchEvent(new MouseEvent('mouseup', opts));
                        el.click();
                        
                        // Handle potential focus/navigation
                        el.focus();
                        return true;
                    }
                    return false;
                })();
            `);
        } else if (plan.action === "type" && plan.selector && plan.text) {
            await this.guestWebContents.executeJavaScript(`
                (function() {
                     let selector = "${plan.selector}";
                     if (!selector.includes('[') && !selector.includes('#') && !selector.includes('.')) {
                        selector = \`[data-agent-id='\${selector}']\`;
                    }
                    const el = document.querySelector(selector);
                    if (el) {
                        el.focus();
                        
                        // React/Angular/Vue hack: directly call native setter
                        const proto = Object.getPrototypeOf(el);
                        const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set || 
                                       Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
                        
                        if (setter && setter.call) {
                            setter.call(el, "${plan.text}");
                        } else {
                            el.value = "${plan.text}";
                        }
                        
                        el.dispatchEvent(new Event('input', { bubbles: true }));
                        el.dispatchEvent(new Event('change', { bubbles: true }));
                        return true;
                    }
                    return false;
                })();
            `);

            // Press Enter just in case, and maybe Tab to trigger blur
            this.guestWebContents.sendInputEvent({ type: 'keyDown', keyCode: 'Enter' });
            this.guestWebContents.sendInputEvent({ type: 'keyUp', keyCode: 'Enter' });
        } else if (plan.action === "scroll") {
            await this.guestWebContents.executeJavaScript(`
                (function() {
                    let selector = "${plan.selector || ''}";
                    if (selector && !selector.includes('[') && !selector.includes('#') && !selector.includes('.')) {
                        selector = \`[data-agent-id='\${selector}']\`;
                    }
                    
                    const el = selector ? document.querySelector(selector) : null;
                    if (el) {
                        el.scrollBy(0, 500);
                    } else {
                        window.scrollBy(0, 500);
                    }
                })();
            `);
        }
    }
}

module.exports = Agent;
