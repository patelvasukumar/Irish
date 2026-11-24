# Irish bug report (2026-11-24)

14 open bugs were found in end-to-end testing of Irish on 24 Nov 2026; 3 are high priority. Core flows work: resume upload (PDF, DOCX, TXT), posting from text, link and screenshot, skill match, tailoring, save to History, Apply, Tracker, Logins and Profile.

## Setup
- Backend: FastAPI at http://127.0.0.1:8000 (docs at /docs), local JSON store, Ollama provider with fallback to the offline template.
- Frontend: Expo web at http://localhost:8081.
- All 38 API routes were called directly; the main screens were also clicked through in the browser.

## High priority
| # | Bug | How to reproduce | Expected | Actual | Where to look |
| --- | --- | --- | --- | --- | --- |
| 1 | Apply creates duplicate tracker jobs | Tailor twice for the same posting, then click Apply on each | Warn "already applied" or reuse the existing job | Two separate "Applied" jobs for one posting | POST /api/apply, backend/api/dependent/resume_routes.py |
| 2 | Login not checked against the posting's company | Apply with a saved login from company A to a posting from company B | Refuse, or only offer logins whose domain matches the posting | Accepted; response says "permitted - open the site to finish applying" | POST /api/apply, credential_manager |
| 3 | Screens show empty data instead of an error when the backend is down | Stop the backend, open Logins, History and Tracker | An error state with a retry button | "No saved logins", "No saved resumes" and "Tracker is on" shown next to the error toast | Logins, History, Tracker screens |

## Medium and low priority
| # | Priority | Bug | How to reproduce | Actual | Where to look |
| --- | --- | --- | --- | --- | --- |
| 4 | Medium | Title is the first line cut at 120 characters | Paste a posting whose first line is a sentence | Title ends mid-word; the long title also becomes the History file name | guess_title_and_company in skill_extractor.py |
| 5 | Medium | "Nice to have" skills counted as required | Posting with a "Nice to have: React, TypeScript" section | Those skills lower the match score as missing | extract_skills / compare_skills |
| 6 | Medium | Common skills missing from the dictionary | Posting mentioning Kafka, Spark or Airflow | Not detected as skills (pytest is fine: it is counted as "Unit Testing") | SKILL_ALIASES |
| 7 | Medium | GitHub link counts as the skill Git | Profile with a GitHub URL but no Git skill | "Git" shows as a matched skill | "github" alias under Git |
| 8 | Medium | Wrong role guess | Match a Data Engineer posting | role_skills says "Data Analyst" | skills_for_title in graph_rag |
| 9 | Medium | Read posting from link fails on simple pages | Read posting with https://example.com/ | "Could not read enough text from this page" | posting_reader.py |
| 10 | Low | "Unknown company" saved as a real company | Apply to a posting with no company | Tracker company filter lists "Unknown company" | /api/apply |
| 11 | Low | No link to open when a login is chosen | Apply with a saved login | Says "open the site" but open_url is null | /api/apply |
| 12 | Low | Province stored as "ON" from the Profile form | Type ON in Province and save | "ON" while the rest of the app uses "Ontario" | Profile screen / profile_service.py |
| 13 | Low | Layout jump after Save on the Tailor tab | Click Save, then click Apply | "Saved in history/..." message pushes the Apply button down | Tailor screen |
| 14 | Low | Tabs have no accessible labels | Inspect bottom navigation and segment tabs with a screen reader | Tabs have no name | Segmented and tab bar components |

## Already fixed, and setup notes
- Fixed: company name read wrongly from postings ("join our payments platform team" became the company; "Shopify - Ottawa, ON" was missed). Fixed in commit 8dba7eb on kavyavasani.
- Not a bug: tailored resumes come from the offline template because Ollama is not running, so tailoring instructions are ignored. Start Ollama (`ollama pull llama3.2`) or use Groq/Gemini to test real AI rewriting.
- Not a bug: the Claude app's built-in browser blocks :8081 -> :8000 calls; in Chrome the app reaches the backend normally (CORS allows all origins).
