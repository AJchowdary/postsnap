#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: |
  Build PostSnap - a cross-platform mobile app for local businesses to create and auto-post
  social media content. Phase 1 (UI) is complete. Phase 2 builds the complete backend:
  Node.js/Express/TypeScript with MongoDB (stub) + Supabase-ready interfaces, Zod validation,
  JWT auth (Email/Password), async job queue, stub AI/Posting/IAP providers, and wires all 
  frontend screens to real API calls. SQL migrations + RLS policies generated for Supabase.

backend:
  - task: "Node.js/Express backend startup and health endpoint"
    implemented: true
    working: true
    file: "/app/apps/api/src/server.ts"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Node.js API starts on port 4001, health at /api/health returns ok. Python proxy on 8001 forwards to 4001."

  - task: "Auth register endpoint (POST /api/auth/register)"
    implemented: true
    working: true
    file: "/app/apps/api/src/routes/auth.ts"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: true
        agent: "main"
        comment: "Tested with curl - returns user object + JWT token. Email uniqueness check works."

  - task: "Auth login endpoint (POST /api/auth/login)"
    implemented: true
    working: true
    file: "/app/apps/api/src/routes/auth.ts"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: true
        agent: "main"
        comment: "Tested with curl - returns JWT for valid credentials, 401 for invalid."

  - task: "Account bootstrap endpoint (POST /api/account/bootstrap)"
    implemented: true
    working: "NA"
    file: "/app/apps/api/src/routes/account.ts"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Implemented, not tested yet."

  - task: "Caption generation (POST /api/generate/caption)"
    implemented: true
    working: true
    file: "/app/apps/api/src/routes/generate.ts"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: true
        agent: "main"
        comment: "Tested with curl - MockAI returns template-based captions. No auth required."

  - task: "Posts CRUD (GET/POST/DELETE /api/posts)"
    implemented: true
    working: "NA"
    file: "/app/apps/api/src/routes/posts.ts"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Implemented with auth. Post save/list/delete all implemented."

  - task: "Publish post with entitlement check (POST /api/posts/:id/publish)"
    implemented: true
    working: "NA"
    file: "/app/apps/api/src/routes/posts.ts"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Stub MetaProvider always succeeds. MockSubscription returns trial=eligible."

  - task: "Social accounts connect/disconnect"
    implemented: true
    working: "NA"
    file: "/app/apps/api/src/routes/social.ts"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Implemented with auth."

  - task: "Subscription status/upgrade (stub)"
    implemented: true
    working: "NA"
    file: "/app/apps/api/src/routes/subscription.ts"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "MockSubscriptionProvider - default trial, upgrade sets to subscribed."

  - task: "Python proxy forwards to Node.js API"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Python FastAPI on 8001 proxies all requests to Node.js on 4001."

frontend:
  - task: "Auth screen (login/register)"
    implemented: true
    working: true
    file: "/app/frontend/app/auth.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: true
        agent: "main"
        comment: "Tested via screenshot - register creates account and redirects to onboarding."

  - task: "Session restore on app start"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/index.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Uses AsyncStorage token + /auth/me to restore session on app start."

  - task: "Onboarding saves profile to backend"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/onboarding.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Calls updateBusinessProfile after user completes onboarding."

  - task: "Create screen generates caption via backend"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/(tabs)/create.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "API client updated to use camelCase params matching new Node.js backend."

  - task: "History screen loads posts from backend"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/(tabs)/history.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "useFocusEffect loads posts from /api/posts on screen focus."

  - task: "Settings saves profile to backend + logout"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/(tabs)/settings.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Save button calls updateBusinessProfile. Logout clears token and goes to /auth."

metadata:
  created_by: "main_agent"
  version: "1.0"
  test_sequence: 1
  run_ui: true

test_plan:
  current_focus:
    - "Auth register endpoint"
    - "Auth login endpoint"
    - "Auth screen login/register"
    - "Session restore on app start"
    - "Onboarding saves profile to backend"
    - "Create screen generates caption via backend"
    - "History screen loads posts from backend"
    - "Settings saves profile to backend + logout"
    - "Publish post with entitlement check"
  stuck_tasks: []
  test_all: true
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: |
      Complete dark theme redesign applied to match the reference design (FinGuru-style dark UI).
      
      NEW SCREENS:
      - welcome.tsx: New landing screen with hero image, gradient Sign Up button, outlined Log In button, social icons, background glow blobs
      - auth.tsx: Completely redesigned with dark theme, separate login/register views (mode param), back button, eye toggle for password, gradient CTA buttons
      
      THEME CHANGES:
      - Background: #0d0d12 (very dark near-black)
      - Primary: #f43f5e (rose/pink) with gradient to #f97316 (orange)
      - All typography updated to white/light
      - Cards: #1c1c28 (dark card background)
      - Borders: rgba(255,255,255,0.10) (subtle white border)
      
      COMPONENTS UPDATED:
      - PrimaryButton.tsx: Now uses LinearGradient (expo-linear-gradient@15.0.8)
      - Tab bar: Dark #13131c background with pink active color
      - Toast: Updated info color for dark theme
      
      AUTH FLOW:
      - index.tsx → /welcome (unauthenticated) or /(tabs)/create (authenticated)
      - /welcome → Sign Up → /auth?mode=register
      - /welcome → Log In → /auth?mode=login
      - Logout → /welcome
      
      TESTING NOTES:
      - App URL: https://postsnap-preview.preview.emergentagent.com
      - Email input: type=email, Password: type=password
      - Welcome screen accessible at /welcome
      - Login at /auth?mode=login, Register at /auth?mode=register
 Here's what was built:
      
      BACKEND (Node.js/Express/TypeScript on port 4001):
      - Full JWT auth (register/login/me) with bcrypt password hashing
      - Account bootstrap + business profile CRUD
      - Posts CRUD + caption generation (MockAI) + publish (stub MetaProvider)
      - Social accounts connect/disconnect
      - Subscription status/upgrade (MockSubscriptionProvider - default trial)
      - In-process async job queue (no Redis needed)
      - All external services behind interfaces (IDatabase, IAIProvider, IPostingProvider, ISubscriptionProvider)
      - MongoDB adapter (working) + Supabase adapter (stub for when credentials arrive)
      - Python proxy on port 8001 forwards all requests to Node.js on 4001
      
      FRONTEND:
      - New auth.tsx screen with login/register forms
      - Updated index.tsx for auth-aware session restore (using AsyncStorage + /auth/me)
      - Updated api.ts with complete API client (auth, posts, generate, social, subscription)
      - Updated appStore.ts with auth state management
      - Onboarding saves profile to backend
      - History screen loads posts from backend on focus
      - Settings: backend profile save + upgrade wiring + logout button
      
      SQL MIGRATIONS at /app/apps/api/migrations/:
      - 001_initial_schema.sql (all tables)
      - 002_rls_policies.sql (Supabase RLS)
      
      IMPORTANT NOTES for testing:
      - Both backend (port 8001 proxy) and node-api (port 4001) must be running
      - No real Supabase or OpenAI credentials - using MongoDB + MockAI
      - Auth uses simple JWT (not Supabase Auth yet)
      - Caption generation via mock returns template-based captions
      - Publishing is always "success" (stub)
      - The app URL is https://postsnap-preview.preview.emergentagent.com
      - For web testing: email input is type="email", password is type="password"
      
      Test the full e2e flow: register → onboarding → create post → generate caption → publish → history
