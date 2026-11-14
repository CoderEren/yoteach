# Historical specification — read the handoff first

The latest user instructions in HANDOFF.md supersede conflicting roadmap, navigation, mascot and workflow requirements below. Stage 1 was approved. Stage 2 revisions are authorized. Stage 3 is NOT yet authorized.

# YOTEACH
**Complete Product Specification, Design Guide & Three-Stage Development Plan**

**Imperial AI Hackathon — Voice, Vision & Generative Media**

---

# READ FIRST — INSTRUCTIONS TO THE CODING AGENT

You are the lead product designer and engineer building **yoteach** (pronounced "yo, teach"), a macOS-first Electron desktop application.

This document is your complete specification, covering the product vision, interface design, mascot, technical architecture, AI integrations, and three-stage implementation plan.

**CRITICAL: BUILD ONLY STAGE 1 NOW.**

Use this GitHub repository as the official codebase:

https://github.com/CoderEren/yoteach

Complete Stage 1, commit your work, provide instructions for testing the application, and STOP.

Do not implement Stage 2 until I explicitly approve Stage 1. Do not implement Stage 3 until I explicitly approve Stage 2.

I want to inspect the application after every stage and potentially change its design, features, or product direction.

Do not treat silence, requests for revisions, or general positive feedback as approval.

Your objective is to build a functional application, not merely generate mockups, plans, or descriptions.

Make reasonable engineering decisions independently, but do not claim that a feature has been implemented or tested unless it actually has.

---

# 0. GITHUB, INITIAL SETUP & WORKING WHILE I AM AWAY

## Official GitHub Repository

https://github.com/CoderEren/yoteach

This repository is the canonical codebase for the application.

Requirements:

- Inspect the repository before making changes.
- Preserve any existing code.
- Use the available GitHub integration or standard Git tools.
- Develop each stage on its own branch.
- For Stage 1, use a branch such as `stage-1-desktop-foundation`.
- Make meaningful commits and push them to GitHub when authorized.
- At the end of each stage, provide the branch name, commit SHA, and GitHub link.
- Do not merge into the default branch without my approval.
- Include a README with local setup instructions.
- Include a `.gitignore` and `.env.example`.
- Never commit API keys, environment secrets, personal documents, or credentials.

If repository access or write permissions are unavailable, continue development locally where possible. Preserve the Git commits and explain what authorization is required to push them. Never claim that code has been pushed unless it actually has.

## Important: I Will Be Away From My Laptop

Assume I cannot respond to questions, enter credentials, authorize permissions, or complete account setup while you are implementing the current stage.

### Before starting Stage 1

Provide one short, consolidated checklist of anything I absolutely must do before leaving.

Distinguish between:

**REQUIRED NOW:** Actions that genuinely prevent you from starting Stage 1.

**CAN WAIT:** Anything that can be configured when I return or during a later stage.

Do not require ElevenLabs keys, fal keys, macOS microphone permissions, screen-recording permissions, or Apple Developer setup for Stage 1.

If there are no essential setup requirements, proceed directly.

### While I am away

- Work autonomously on the current approved stage.
- Make sensible implementation decisions without asking unnecessary questions.
- If credentials or permissions are missing, complete all unaffected functionality.
- Create secure configuration placeholders for later setup.
- Document outstanding user-only actions in `SETUP_REQUIRED.md`.
- Do not invent credentials, bypass permissions, or falsely claim integrations work.
- Do not stop all development because an optional integration cannot be configured.
- Do not start the next stage without my explicit approval.
- Do not assume my laptop remains powered on or that I can run commands while absent.
- If the development environment cannot test macOS-specific UI behavior, run the available tests and provide instructions for me to verify it when I return.

### Setup That Can Wait

**Stage 2:**
- ElevenLabs account/API credentials or agent configuration.
- Vision-capable model API credentials.
- macOS microphone permission.
- macOS screen-recording permission.

**Stage 3:**
- fal API key.
- Any required fal credits or billing configuration.
- Selection of specific image/video generation models.

Never request API credentials through committed files, public GitHub issues, or pull requests.

Use secure local configuration. Keep paid API testing bounded to avoid unnecessary costs.

---

# 1. PRODUCT OVERVIEW

## Name

**yoteach**

Pronounced "yo, teach!"

Working tagline: **A tutor that sees what you see.**

Product category: Persistent, screen-aware AI learning companion.

Target audience: University students studying from lecture slides, textbooks, PDFs, videos, websites, notes, and problem sets.

## One-Line Pitch

Yoteach is an AI tutor that floats alongside your desktop, sees what you're studying with your permission, talks to you naturally, points and draws on your screen, creates interactive visual explanations on demand, and remembers what you've learned.

## Product Vision

Build an intelligent desktop learning companion that fundamentally changes how students interact with educational materials.

Instead of forcing students to switch between their lecture slides, ChatGPT, YouTube, and various study tools, yoteach should accompany them wherever they study.

The tutor should understand the student's current context, provide natural voice explanations, visually demonstrate difficult concepts, and gradually build a persistent understanding of the student's learning journey.

Unlike an ordinary chatbot, yoteach should not just answer questions. It should actively teach.

It should be able to:

- See the student's screen.
- Understand what the student is studying.
- Speak naturally.
- Move around the screen.
- Point at relevant information.
- Draw and highlight.
- Generate diagrams and animations.
- Create interactive lessons.
- Ask questions to check understanding.
- Remember previous interactions.
- Identify recurring learning difficulties.
- Suggest appropriate next steps.

## The Most Important Product Decision

This is **one product with two connected interfaces**, not two separate applications.

### A. Desktop Companion

The primary experience.

An animated AI mascot lives on the student's desktop.

It can appear above PDFs, browsers, videos, and other applications.

It understands the visible study material, communicates through voice, points to relevant information, draws annotations, and opens interactive explanations.

### B. Learning Workspace

The persistent home of the student and their tutor.

Students can upload educational material, browse an organized roadmap of topics, revisit previous explanations, access generated visualizations, and track learning progress.

Every meaningful interaction with the desktop companion should contribute to this workspace.

**The desktop companion is the hero experience. The learning workspace provides persistence.**

Both must share the same courses, topics, artifacts, and learning memory.

---

# 2. CORE USER EXPERIENCE

## 2.1 Learning Workspace and Course Creation

When students open yoteach, they should see a beautiful, modern learning dashboard.

They can create courses such as:

- Biochemistry
- Calculus
- Physics
- Organic Chemistry
- Computer Science

Within each course, students can upload educational materials.

Initially support PDF uploads. The architecture should allow PPTX, notes, and additional document formats in the future.

The system processes the lecture materials and organizes their content into a structured learning roadmap.

For example:

**Biochemistry**

- Introduction to Metabolism
- Glycolysis
  - Overview
  - Energy Investment Phase
  - Energy Payoff Phase
  - Regulation
- Krebs Cycle
- Electron Transport Chain

The roadmap should be easy to navigate and visually attractive.

Each topic should have its own workspace containing:

- Topic overview.
- Relevant lecture material.
- Source-page references.
- Saved tutor explanations.
- Previously generated diagrams and animations.
- Interactive lessons.
- Practice questions and responses.
- Areas needing further review.

Students should be able to return to these resources after restarting the app.

### Important Product Constraint

Uploading a lecture should **not automatically generate animated videos for every slide**.

The initial purpose of uploading is to organize learning material into topics.

Interactive lessons should be generated when requested or when the tutor suggests that a visualization would help.

Students should remain free to study from their original lecture slides.

Do not build a separate, standalone lecture-to-video platform.

## 2.2 Desktop AI Companion

The desktop companion is a small animated mascot that floats above other applications.

It should be:

- Draggable.
- Always available during study sessions.
- Expandable into a small conversation panel.
- Minimizable and hideable.
- Expressive and responsive.
- Unobtrusive when not in use.

The mascot should support the following visual states:

- Idle.
- Listening.
- Thinking.
- Speaking.
- Pointing.
- Celebrating progress.
- Unavailable/error.

The student can activate the tutor using a button or keyboard shortcut.

The tutor should support both natural voice conversations and text input.

The personality should feel intelligent, friendly, curious, and encouraging—not childish or excessively enthusiastic.

### Example

A student is reading lecture slides about glycolysis.

They activate the tutor and ask:

"Why does glycolysis require ATP at the beginning?"

The tutor analyzes the visible slide, identifies the relevant pathway, and moves or points toward the appropriate area.

It highlights the ATP-consuming reactions and explains their purpose using ElevenLabs.

The student can interrupt, ask follow-up questions, or request a different explanation.

The experience should feel like a knowledgeable tutor sitting next to the student, looking at the same material.

## 2.3 Screen Awareness and Visual Teaching

The tutor should be able to understand content that the student explicitly chooses to share.

Supported workflows should include:

- Reading lecture PDFs.
- Looking at presentation slides.
- Studying websites.
- Watching educational videos.
- Working through problem sets.

Screen observation must require user permission.

Provide clear indicators showing whether the microphone and screen observation are active.

The student must be able to stop observation immediately.

### Visual Interaction Capabilities

The tutor should be able to:

- Highlight text or diagrams.
- Point to specific regions.
- Draw circles and arrows.
- Underline important information.
- Add short contextual labels.
- Create simple sketches.
- Open small visual explanation panels.
- Launch interactive diagrams and animations.

Annotations must be grounded in actual screen content.

Do not use arbitrary coordinates to simulate screen understanding.

If precise annotation over arbitrary third-party applications is unreliable, start with accurate annotation inside an internal PDF viewer or over a captured screenshot.

Handle different display sizes, scaling, and window coordinates carefully.

Do not confuse drawing an overlay with actually modifying or controlling another application.

## 2.4 On-Demand Interactive Visual Explanations

Students should be able to say:

- "Show me how this works."
- "Can you animate this?"
- "Explain this visually."
- "Turn this topic into an interactive lesson."
- "Let me experiment with this concept."

The tutor should select an appropriate visual teaching format.

Examples include:

**Biochemistry:** Step-by-step molecular process animations.

**Mathematics:** Interactive graphs with adjustable parameters.

**Physics:** Visual simulations of forces, fields, or motion.

**Computer Science:** Animated algorithms and data structures.

**Other subjects:** Flowcharts, decision trees, diagrams, visual comparisons, or generated illustrations.

An interactive lesson is not necessarily a generative video.

Use deterministic, programmatically controlled diagrams for content requiring precision and interaction.

Use fal-generated images or videos where generative media genuinely improves understanding.

### Interactive Lesson Viewer

The lesson viewer should support:

- Step-by-step progression.
- Spacebar navigation.
- Previous and next buttons.
- Replay.
- Play/pause.
- Voice narration.
- Follow-up questions.
- Saving to the relevant topic.

### Example: Glycolysis

A student asks:

"Show me the first step of glycolysis."

The tutor opens an interactive visualization showing:

1. Glucose.
2. ATP.
3. The relevant phosphate transfer.
4. Formation of glucose-6-phosphate and ADP.

The student presses the spacebar to progress through each step.

The tutor narrates the process using ElevenLabs.

The student can ask questions while interacting with the visualization.

For scientifically important mechanisms, prioritize accurate, validated diagrams over potentially misleading generated videos.

## 2.5 Persistent Learning Memory

Every meaningful tutoring interaction should contribute to the student's learning history.

Store:

- Courses and topics.
- Uploaded materials.
- Study sessions.
- Important questions.
- Saved tutor explanations.
- Generated diagrams and lessons.
- Practice attempts.
- Potential misconceptions.
- Learning preferences.

For example, after studying glycolysis, the topic workspace might contain:

**Glycolysis → Energy Investment Phase**

- Original lecture slides.
- Explanation of ATP consumption.
- Interactive phosphorylation animation.
- Previous questions.
- Practice answers.
- Potential misconception about ATP investment.
- Suggested review activity.

When the student returns later, the tutor should remember previous discussions.

Example:

"Last time we explored why ATP is invested during early glycolysis. Want to review it?"

Do not assume that time spent on a page equals understanding.

Learning progress should be based on evidence such as practice answers and demonstrated comprehension.

Allow users to review and delete saved learning information.

## 2.6 Proactive Tutoring

Eventually, the tutor should be able to notice when a student might need assistance.

Potential signals include:

- Repeated unsuccessful attempts.
- Returning to the same confusing concept.
- Asking similar questions repeatedly.
- Demonstrating the same misunderstanding across sessions.

It might ask:

"Want a hint?"

Or:

"This seems similar to something you struggled with earlier. Want to approach it differently?"

Proactivity should be optional, subtle, dismissible, and rate-limited.

Do not assume that staying on the same screen for a long time automatically means confusion.

Never observe private windows or continue screen observation after the student pauses or stops it.

---

# 3. BRAND IDENTITY AND DESIGN GUIDE

## 3.1 Overall Aesthetic

Yoteach should look like a premium, modern consumer application.

The desired aesthetic is:

**Clean, minimal, elegant, futuristic, fluid, and inspired by liquid glass.**

Imagine modern macOS design blended with an approachable next-generation educational product.

The interface should feel:

- Beautiful but functional.
- Advanced but friendly.
- Playful without being childish.
- Minimal without being empty.
- Calm without being boring.

Use a liquid-glass visual language featuring:

- Translucent panels.
- Background blur.
- Soft layered surfaces.
- Subtle luminous edges.
- Gentle depth.
- Light-refraction-inspired highlights.
- Smooth animations.
- Carefully controlled gradients.
- Rounded corners.
- Elegant typography.

Do not directly copy Apple's proprietary interface or another company's design.

The dashboard, desktop avatar, and interactive lesson viewer must feel like parts of the same product.

## 3.2 Brand Voice

Product name in UI: **yoteach**

Friendly invocation: **"yo, teach?"**

Personality:

- Smart.
- Approachable.
- Encouraging.
- Curious.
- Concise.
- Confident without being arrogant.

Avoid generic chatbot phrases and excessive cheerfulness.

The central idea is that difficult concepts become clearer through interaction.

## 3.3 Provisional Mascot — Yoyo

Create an original mascot named **Yoyo**.

This is a provisional concept. We may keep it or replace it after reviewing Stage 1.

The mascot must therefore be implemented in a modular, replaceable way.

### Appearance

Yoyo is a small hovering, rounded, glass-like creature.

Visual characteristics:

- Rounded, slightly pear-shaped body.
- Soft frosted lavender-to-icy-blue coloration.
- Semi-translucent appearance.
- Two tiny floating teardrop-shaped ears or fins.
- Expressive dark eyes.
- Subtle eyebrows.
- Small mouth.
- Short flexible arms.
- A soft diffused shadow beneath the character.
- Gentle internal glow.
- Slowly shifting internal gradients.

Yoyo should feel like a friendly living piece of liquid glass.

It should be memorable, recognizable, and visually appealing at small sizes.

Avoid overly detailed 3D modeling, generic emoji aesthetics, and existing copyrighted character designs.

### Mascot Animations

**Idle:** Gentle hovering and breathing motion.

**Listening:** Ears perk up; a subtle glowing outline pulses.

**Thinking:** Eyes glance upward with a small orbiting spark.

**Speaking:** Small mouth and body movements corresponding to voice activity.

**Pointing:** An arm extends toward the relevant content.

**Success:** A gentle celebratory bounce.

**Error:** Calm expression with a clear informative message.

The mascot should never obstruct the student's work for extended periods.

Use SVG, CSS, React animation, or lightweight Canvas for the initial implementation.

Do not depend on generative image/video APIs to animate the mascot.

Keep its appearance separate from its behavioral logic so we can redesign it later.

## 3.4 Color Palette

Use these as initial design tokens, not immutable requirements.

### Light Theme

- Background: `#F6F8FC`
- Secondary background: `#EEF3FC`
- Primary text: `#172034`
- Secondary text: `#657188`
- Glass panels: translucent white with approximately 55–75% opacity.
- Borders: subtle translucent white/blue.
- Ambient background: very soft blue and lavender gradients.

### Dark Theme

- Background: `#0B1020`
- Primary text: `#F4F7FF`
- Secondary text: `#A0ACC4`
- Glass panels: translucent deep slate or indigo.
- Ambient background: subtle indigo and teal lighting.

### Accent Colors

- Primary iris: `#7668F6`
- Alternative iris: `#8278FF`
- Cyan: `#55C8D9`
- Learning success: `#49BBA7`
- Needs review: `#E3AE5E`

Use color selectively.

Avoid covering the application with intense gradients or neon effects.

## 3.5 Typography

Use a modern sans-serif font such as Inter, Geist, or a suitable system equivalent.

Requirements:

- Strong visual hierarchy.
- Clean headings.
- Comfortable line spacing.
- Clear body text.
- Consistent typography.
- Excellent contrast and readability.

Do not sacrifice readability for the glass effect.

## 3.6 Liquid Glass Components

Glass surfaces should use:

- Controlled translucency.
- Backdrop blur.
- Thin borders.
- Subtle inner highlights.
- Soft shadows.
- Rounded corners.
- Meaningful depth.

Avoid:

- Heavy neon outlines.
- Excessive blur.
- Extremely low-contrast text.
- Large decorative gradients everywhere.
- Overcomplicated particle effects.
- Giant empty decorative areas.

Use opaque or more strongly frosted surfaces where necessary to maintain legibility.

### Core UI Components

**Sidebar:** Compact translucent course navigation.

**Dashboard:** Welcoming header, course cards, recent activity, continue-learning section.

**Roadmap:** Elegant hierarchical topic navigation.

**Topic Workspace:** Calm, focused reading and review layout.

**Study Button:** Clear and attractive primary action.

**Floating Mascot:** Compact, delightful, and unobtrusive.

**Lesson Viewer:** Large central visualization with minimal controls.

**Permissions:** Clear microphone and screen-observation indicators.

## 3.7 Motion and Microinteractions

Animations should be smooth, subtle, and intentional.

Recommended interaction timing:

- Basic controls: approximately 150–300 ms.
- Mascot movements: slightly longer and more organic.
- Page transitions: smooth but not distracting.

Use clear hover, pressed, loading, and focus states.

Respect reduced-motion accessibility preferences.

## 3.8 Design Quality Requirements

The application should not look like a generic AI-generated SaaS dashboard.

It should have a distinctive visual identity.

Build polished versions of:

- Empty states.
- Loading states.
- Error states.
- Success states.
- Populated screens.

Maintain keyboard accessibility, sufficient color contrast, sensible spacing, and usable control sizes.

---

# 4. AI INTEGRATIONS

## 4.1 ElevenLabs — Conversational AI Tutor

Use ElevenLabs for the real-time conversational experience.

ElevenLabs should power meaningful voice interaction, not simply read static responses aloud.

Required capabilities:

- Natural voice conversations.
- Live microphone input.
- Spoken responses.
- Conversational interruptions where supported.
- Context-aware responses.
- Tool calling.
- Clear connection indicators.
- Text fallback.

The agent should understand the current topic, relevant learning materials, and available learning history.

### Agent Tools

Design real application actions corresponding to functions such as:

- `analyze_current_screen`
- `highlight_screen_region`
- `draw_annotation`
- `open_topic`
- `generate_visual_explanation`
- `generate_interactive_lesson`
- `save_learning_artifact`
- `ask_practice_question`
- `record_practice_attempt`
- `record_possible_misconception`

These must invoke actual application functionality when implemented.

Do not simulate agentic behavior through decorative animations.

Validate tool arguments and provide proper error handling.

Use currently supported ElevenLabs APIs and SDKs.

## 4.2 fal — Generative Visual Teaching

Integrate fal's generative image and video capabilities.

Use fal to create educational visual material in response to student needs.

Possible uses:

- Scientific illustrations.
- Visual analogies.
- Diagrams.
- Conceptual images.
- Short educational video clips.
- Personalized learning visuals.

The tutor should be able to request media generation based on the student's current question or topic.

Generated content should appear inside the learning interface and be saveable to the corresponding topic.

Support asynchronous generation and loading states.

Keep the selected fal model configurable.

**Important:** A fal-generated video is not the same as an interactive simulation.

Use programmatic animations for precise and manipulable educational content.

Combine programmatic interaction and fal media when useful.

At least one real fal image or video generation call must be part of the Stage 3 hackathon demonstration.

---

# 5. TECHNICAL ARCHITECTURE

## Recommended Technology Stack

**Desktop application:** Electron.

**Frontend:** React and TypeScript.

**Styling:** Tailwind CSS or equivalent token-based CSS.

**Animations:** Motion/Framer Motion, CSS, SVG, or Canvas.

**Desktop capabilities:** Electron main process and secure preload APIs.

**Screen capture:** Electron desktop capture APIs with appropriate macOS permissions.

**Voice:** ElevenLabs.

**Vision and reasoning:** A suitable vision-capable multimodal API.

**Generative media:** fal.

**Persistence:** SQLite or another reliable local database.

**Document processing:** PDF text extraction and rendering.

**Interactive lessons:** React, SVG, Canvas, and structured lesson definitions.

## Security Requirements

- Enable Electron context isolation.
- Disable renderer Node integration.
- Use minimal, typed preload APIs.
- Validate IPC and agent tool inputs.
- Protect external links and local file paths.
- Never expose private API keys in renderer code.
- Never commit credentials.
- Avoid retaining screenshots unnecessarily.
- Require explicit permission for screen observation.
- Provide immediate screen-sharing pause/stop controls.
- Handle unavailable permissions gracefully.
- Provide clear network and API error states.

## Local Development

The app should run on macOS using a command such as:

`npm install`

`npm run dev`

No App Store submission, public hosting, Apple Developer account, or Xcode IDE project should be required for ordinary local testing.

Certain native dependencies may require Apple Command Line Tools.

## Suggested Data Model

**Course**
- id
- title
- createdAt

**Topic**
- id
- courseId
- parentId
- title
- order
- status
- sourceRefs

**SourceDocument**
- id
- courseId
- originalName
- localPath
- extractedText
- pageMap

**StudySession**
- id
- courseId
- topicId
- startedAt
- endedAt

**TutorInteraction**
- id
- sessionId
- topicId
- userQuestion
- tutorSummary
- createdAt

**LearningArtifact**
- id
- topicId
- type
- title
- payloadOrPath
- sourceRefs
- createdAt

**PracticeAttempt**
- id
- topicId
- question
- studentAnswer
- feedback
- createdAt

**Misconception**
- id
- topicId
- description
- evidenceRefs
- confidence
- createdAt

**Settings**
- theme
- voiceEnabled
- screenObservationEnabled
- proactiveHelpEnabled

This is a suggested architecture. Start simple and extend it as the project progresses.

Do not over-engineer the database during Stage 1.

---

# 6. THREE-STAGE IMPLEMENTATION PLAN

**THIS IS A STRICT THREE-STAGE DEVELOPMENT PROCESS.**

Implement one stage at a time.

After each stage, STOP and request my approval.

I must be able to inspect the current implementation before deciding whether to continue.

The complete product description above defines our long-term direction, not authorization to build every feature immediately.

---

# STAGE 1 — ELECTRON FOUNDATION, WORKSPACE & MASCOT

## Goal

Create a visually polished, functional Electron desktop application featuring the learning dashboard, course organization, PDF upload, roadmap, and floating Yoyo mascot.

This stage focuses on the product's visual identity and structural foundations.

## Features to Implement

### 1. Electron Application

- Configure Electron, React, and TypeScript.
- Create a functioning macOS desktop application.
- Establish secure preload communication.
- Configure application windows and lifecycle.
- Make the app runnable through `npm run dev`.

### 2. Dashboard

Create the main learning dashboard.

Include:

- Course cards.
- Create/rename/delete course functionality.
- Recent activity.
- Continue-learning section.
- Learning roadmap navigation.
- Clean empty states.

Apply the liquid-glass styling guide.

### 3. PDF Upload and Course Organization

- Allow users to upload lecture PDFs.
- Extract readable text.
- Display uploaded documents.
- Create basic roadmaps from identifiable document headings or sections.
- Allow manual editing when automatic organization is insufficient.
- Associate materials with the appropriate course.

Do not pretend sophisticated AI roadmap generation exists yet if no AI has been integrated.

### 4. Topic Workspace

Create navigable topic pages containing sections for:

- Overview.
- Source materials.
- Saved explanations.
- Interactive lessons.
- Practice history.
- Learning progress.

Use polished placeholders for functionality planned for later stages.

### 5. Floating Yoyo Mascot

Create a real transparent, always-on-top Electron window containing Yoyo.

Required:

- Draggable.
- Visible above other applications.
- Animated idle state.
- Demonstrable listening, thinking, and speaking states.
- Click-to-expand compact interface.
- Hide and restore controls.
- Menu-bar/tray or equivalent restoration functionality.

At this stage, mascot animation states may be demonstrated without real voice input. Clearly label such behavior as a UI preview.

### 6. Local Persistence

Store courses, topics, document references, and relevant settings locally.

Data must survive restarting the application.

### 7. Design System

Implement the styling guide with reusable tokens and components.

Keep the mascot easy to replace.

## Do Not Implement Yet

- Real ElevenLabs conversations.
- Live screen understanding.
- AI screen annotations.
- fal generation.
- Complex interactive lessons.
- Advanced learning predictions.

## Stage 1 Acceptance Criteria

The stage is complete when:

1. The Electron application launches locally.
2. The dashboard is navigable and visually polished.
3. A course can be created.
4. A PDF can be uploaded and viewed.
5. Topics can be opened.
6. Yoyo floats above another desktop application.
7. Yoyo can be dragged, hidden, and restored.
8. Data persists after restarting the app.

## Mandatory Review Checkpoint 1

When finished:

- Commit and push the Stage 1 branch if authorized.
- Provide the GitHub branch and commit SHA.
- Explain how I can run the application.
- Summarize working and placeholder features.
- Provide a short manual testing checklist.
- Ask for feedback about the dashboard, roadmap, mascot, styling, and desktop interaction.

**STOP.**

Do not begin Stage 2 until I explicitly approve.

If I request design changes, make those changes within Stage 1 and present them for another review.

---

# STAGE 2 — ELEVENLABS, SCREEN AWARENESS & VISUAL ANNOTATIONS

**BEGIN ONLY AFTER EXPLICIT APPROVAL OF STAGE 1.**

## Goal

Turn Yoyo into a functioning screen-aware, conversational AI tutor.

This is the core interaction that differentiates yoteach from ordinary educational chatbots.

## Features to Implement

### 1. ElevenLabs Integration

- Connect ElevenLabs conversational agents.
- Support real microphone conversations.
- Provide spoken AI answers.
- Support interruptions and turn-taking where available.
- Animate Yoyo based on speaking/listening state.
- Add text input as an alternative.
- Display clear connection status.

### 2. Screen Awareness

- Allow explicit screen-sharing permission.
- Capture the selected screen/window where supported.
- Send relevant screenshots to a vision-capable model.
- Use visual context to answer student questions.
- Display active capture indicators.
- Allow immediate stopping of screen capture.

### 3. Grounded Visual Annotations

Implement:

- Highlights.
- Arrows.
- Circles.
- Pointing.
- Labels.

The annotations must correspond to actual visible information.

Prioritize reliable annotation inside the PDF viewer or a captured screenshot if arbitrary desktop overlays cannot yet be implemented accurately.

### 4. Agentic Tool Calling

Connect the ElevenLabs agent to real application tools, including:

- Analyze screen.
- Highlight content.
- Draw annotation.
- Open topic.
- Save explanation.
- Record learning interaction.

Tool actions must genuinely affect the application.

### 5. Connected Learning Memory

- Associate tutoring sessions with courses and topics.
- Store meaningful questions and explanations.
- Make saved explanations accessible inside the workspace.
- Preserve interactions between application restarts.

### 6. Optional Basic Proactive Assistance

If feasible, add a basic opt-in proactive-help mechanism.

Keep it conservative and nonintrusive.

Prioritize the accuracy and responsiveness of the main tutor before adding proactivity.

## Do Not Implement Yet

- Full fal integration.
- Arbitrary AI-generated interactive lesson engines.
- Universal computer control.
- Sophisticated learning analytics.

## Stage 2 Acceptance Criteria

1. Start a study session.
2. Enable screen observation.
3. Open a lecture PDF.
4. Ask Yoyo a question about the visible content.
5. Receive a relevant spoken explanation using ElevenLabs.
6. See an appropriate annotation on the relevant content.
7. Ask a follow-up question.
8. Save the explanation.
9. Reopen the app and find the saved interaction.

## Mandatory Review Checkpoint 2

When finished:

- Commit and push the Stage 2 branch if authorized.
- Provide the GitHub branch and commit SHA.
- List required API credentials and configuration.
- Provide instructions for testing a real conversation.
- Explain latency, annotation accuracy, and known limitations.
- Ask for feedback about Yoyo's voice, personality, screen interaction, and responsiveness.

**STOP.**

Do not begin Stage 3 until I explicitly approve.

---

# STAGE 3 — INTERACTIVE LESSONS, FAL & PERSONALIZED LEARNING

**BEGIN ONLY AFTER EXPLICIT APPROVAL OF STAGE 2.**

## Goal

Complete the differentiated educational experience with interactive visual lessons, generative teaching media, and meaningful persistent learning memory.

This stage should produce the complete hackathon demonstration.

## Features to Implement

### 1. Interactive Lesson Generator

Allow students to request:

- "Show me how this works."
- "Animate this process."
- "Turn this into an interactive lesson."
- "Explain this visually."

Create a reusable interactive lesson viewer.

Required:

- Structured steps.
- SVG/React visual scenes.
- Spacebar navigation.
- Previous/next.
- Play/pause.
- Replay.
- Voice narration.
- Saving lessons to topics.

Start with one excellent, accurate interactive glycolysis example.

Focus on reliability and visual polish rather than trying to generate every possible lesson type.

### 2. fal Integration

Integrate at least one real fal generative image or video model.

- Accept visual-generation requests from the tutor.
- Generate contextually relevant educational media.
- Display progress.
- Handle API errors and latency.
- Save generated media to the appropriate topic.
- Allow the student to revisit it.

Do not present prerecorded assets as evidence of a working fal integration.

### 3. Interactive Educational Visualizations

Create a flexible system for:

- Step-by-step process diagrams.
- Interactive scientific explanations.
- Basic mathematical graphs.
- Visual comparisons.
- Manipulable teaching components.

Use deterministic programmatic animation where precise scientific or mathematical relationships are needed.

### 4. Voice-Controlled Visual Teaching

The ElevenLabs tutor should be able to open interactive lessons through tool calls.

Students should be able to ask questions while viewing the lesson.

### 5. Learning Memory and Practice

Implement:

- Practice questions.
- Student answer recording.
- Feedback.
- Evidence-based possible misconception tracking.
- Topic review suggestions.
- Saved explanations.
- Persistent visual artifacts.

The app should organize these under the correct course and topic.

### 6. Hackathon Demo Polish

Improve:

- Animation smoothness.
- Mascot interactions.
- UI transitions.
- Loading states.
- Error handling.
- Overall demo reliability.
- Consistency of the design language.

## Complete Hackathon Demonstration

The final demonstration should follow this journey.

**Step 1 — Upload**

Student opens yoteach and uploads a biochemistry lecture PDF.

**Step 2 — Roadmap**

Yoteach organizes the material into topics.

Student navigates to:

Glycolysis → Energy Investment Phase.

**Step 3 — Desktop Study**

Student opens the relevant lecture slide.

Yoyo appears on the desktop.

**Step 4 — Conversational Tutoring**

Student asks:

"Why do we spend ATP at the beginning of glycolysis?"

Yoyo responds using ElevenLabs, explains the concept, and highlights the relevant slide region.

**Step 5 — Interactive Visual Explanation**

Student says:

"Show me what happens."

Yoyo opens an interactive glucose phosphorylation demonstration.

Student presses the spacebar to advance through the reaction.

**Step 6 — fal Generation**

Yoteach generates a complementary educational illustration or short clip using fal.

The media appears in the lesson and can be saved.

**Step 7 — Test Understanding**

Yoyo asks a short practice question.

The student gives an incorrect answer.

Yoyo explains the misunderstanding and records a possible misconception.

**Step 8 — Demonstrate Persistence**

Student returns to the learning workspace.

The corresponding topic now contains:

- Saved explanation.
- Interactive lesson.
- fal-generated media.
- Practice interaction.
- Possible misconception.
- Suggested review activity.

**Step 9 — Restart**

Close and reopen the application.

The learning history and generated artifacts should still exist.

## Stage 3 Acceptance Criteria

The full demonstration should work in one coherent application.

Both ElevenLabs and fal must have real, functioning integrations.

The learning workspace and desktop companion must share persistent data.

Document any remaining technical limitations honestly.

## Mandatory Review Checkpoint 3

When finished:

- Commit and push Stage 3 if authorized.
- Provide GitHub branch and commit details.
- Demonstrate the complete student journey.
- Confirm which real API calls were tested.
- Explain setup instructions.
- List working features and known limitations.
- Ask for my final review.

**STOP.**

Do not independently create a fourth stage or add unrelated features.

---

# 7. UNIVERSAL APPROVAL RULES

These requirements apply to every stage.

At the end of each stage:

1. Verify the implementation as far as the available environment allows.
2. Explain what is working.
3. Explain what is simulated, incomplete, or blocked.
4. Provide exact local testing instructions.
5. Identify any required setup.
6. Report the relevant GitHub branch and commit, if available.
7. Invite feedback.
8. Stop implementation.

**Explicit approval is mandatory before beginning the next stage.**

Examples:

"Approve Stage 1; proceed to Stage 2."

"Approve Stage 2; proceed to Stage 3."

If I request changes, implement only those changes within the current stage and return to the same approval checkpoint.

Do not interpret feedback as permission to proceed.

A polished-looking fake AI tutor does not satisfy the requirements for actual ElevenLabs, screen-vision, and fal integrations.

---

# 8. FINAL INSTRUCTION — START NOW

Read this complete specification carefully.

Build the product under the name **yoteach**, using **Yoyo** as the initial, replaceable mascot concept.

Use a premium, clean, modern liquid-glass design throughout.

Use **Electron + React + TypeScript**, targeting macOS first.

Use the official repository:

https://github.com/CoderEren/yoteach

Because I will be away from my laptop, identify any truly essential setup requirements before starting. Everything that can wait should wait.

Make reasonable development decisions independently.

Do not interrupt implementation for optional questions or configuration.

**IMPLEMENT STAGE 1 ONLY.**

Create the functional Electron app, dashboard, PDF upload, topic roadmap, and floating Yoyo mascot.

Commit and push to GitHub if authorized.

Provide the exact commands to run the application locally, plus any deferred setup instructions.

Explain what has been implemented, what remains unfinished, and what I should inspect.

**THEN STOP AND WAIT FOR MY EXPLICIT APPROVAL BEFORE STARTING STAGE 2.**