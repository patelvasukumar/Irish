"""
C1 - Text recognition: find skills and key details in a resume or job posting.

Pure functions only (no I/O) so they can be unit tested on their own.
The first version uses a curated skill dictionary + regular expressions.
It can later be upgraded to embeddings (Hugging Face) without changing
the function signatures.
"""
from __future__ import annotations

import re
from collections import Counter

# canonical skill -> list of aliases (lower case)
SKILL_ALIASES: dict[str, list[str]] = {
    # Languages
    "Python": ["python", "python3"],
    "Java": ["java"],
    "JavaScript": ["javascript", "js", "ecmascript"],
    "TypeScript": ["typescript", "ts"],
    "C#": ["c#", "csharp", "c sharp"],
    "C++": ["c++", "cpp"],
    "C": ["c programming", "ansi c"],
    "Go": ["golang"],
    "Rust": ["rust"],
    "Kotlin": ["kotlin"],
    "Swift": ["swift"],
    "PHP": ["php"],
    "Ruby": ["ruby"],
    "R": ["r programming", "rstudio"],
    "SQL": ["sql", "t-sql", "pl/sql", "plsql"],
    "Bash": ["bash", "shell scripting", "shell script"],
    "PowerShell": ["powershell"],
    "HTML": ["html", "html5"],
    "CSS": ["css", "css3", "sass", "scss"],
    # Frameworks / libraries
    "React": ["react", "react.js", "reactjs"],
    "React Native": ["react native"],
    "Angular": ["angular", "angularjs"],
    "Vue": ["vue", "vue.js", "vuejs"],
    "Node.js": ["node", "node.js", "nodejs"],
    "Express": ["express.js", "expressjs"],
    "Next.js": ["next.js", "nextjs"],
    "Django": ["django"],
    "Flask": ["flask"],
    "FastAPI": ["fastapi"],
    "Spring Boot": ["spring boot", "spring framework"],
    ".NET": [".net", "dotnet", "asp.net", ".net core"],
    "Flutter": ["flutter"],
    "Expo": ["expo"],
    "Tailwind CSS": ["tailwind", "tailwindcss"],
    "Bootstrap": ["bootstrap"],
    "jQuery": ["jquery"],
    "Pandas": ["pandas"],
    "NumPy": ["numpy"],
    "Scikit-learn": ["scikit-learn", "sklearn"],
    "TensorFlow": ["tensorflow"],
    "PyTorch": ["pytorch"],
    "Hugging Face": ["hugging face", "huggingface"],
    "LangChain": ["langchain"],
    "OpenCV": ["opencv"],
    # Data / AI
    "Machine Learning": ["machine learning", "ml"],
    "Deep Learning": ["deep learning"],
    "NLP": ["nlp", "natural language processing"],
    "Computer Vision": ["computer vision"],
    "LLM": ["llm", "large language model", "large language models", "generative ai", "genai"],
    "RAG": ["rag", "retrieval augmented generation", "retrieval-augmented generation"],
    "Data Analysis": ["data analysis", "data analytics"],
    "Data Visualization": ["data visualization", "tableau", "power bi"],
    "Statistics": ["statistics", "statistical analysis"],
    "Excel": ["excel", "microsoft excel", "ms excel"],
    # Databases
    "PostgreSQL": ["postgresql", "postgres"],
    "MySQL": ["mysql"],
    "SQL Server": ["sql server", "mssql"],
    "Oracle": ["oracle", "oracle database"],
    "MongoDB": ["mongodb", "mongo"],
    "Redis": ["redis"],
    "Neo4j": ["neo4j", "cypher"],
    "SQLite": ["sqlite"],
    "Firebase": ["firebase", "firestore"],
    # Cloud / DevOps
    "AWS": ["aws", "amazon web services", "ec2", "s3", "lambda"],
    "Azure": ["azure", "microsoft azure"],
    "Google Cloud": ["gcp", "google cloud", "google cloud platform"],
    "Docker": ["docker", "containers", "containerization"],
    "Kubernetes": ["kubernetes", "k8s"],
    "Terraform": ["terraform"],
    "CI/CD": ["ci/cd", "continuous integration", "continuous deployment", "github actions", "jenkins", "gitlab ci"],
    "Linux": ["linux", "unix", "ubuntu"],
    "Windows Server": ["windows server", "active directory"],
    "Networking": ["networking", "tcp/ip", "dns", "dhcp", "vpn", "cisco"],
    "Git": ["git", "github", "gitlab", "bitbucket"],
    # Practices
    "REST API": ["restful", "rest api", "rest apis", "api development"],
    "GraphQL": ["graphql"],
    "Microservices": ["microservices", "microservice"],
    "Agile": ["agile", "scrum", "kanban", "jira"],
    "Unit Testing": ["unit testing", "unit tests", "pytest", "junit", "jest", "tdd"],
    "QA Testing": ["qa", "quality assurance", "test cases", "manual testing", "selenium", "automated testing"],
    "Object-Oriented Programming": ["oop", "object-oriented", "object oriented"],
    "Cybersecurity": ["cybersecurity", "information security", "penetration testing", "siem", "firewall"],
    "UI/UX Design": ["ui/ux", "ux", "ui design", "figma", "user experience"],
    "Mobile Development": ["mobile development", "android", "ios"],
    "Technical Support": ["technical support", "help desk", "helpdesk", "troubleshooting"],
    # Soft skills
    "Communication": ["communication", "communication skills", "verbal and written"],
    "Teamwork": ["teamwork", "team player", "collaboration", "collaborative"],
    "Problem Solving": ["problem solving", "problem-solving", "analytical"],
    "Leadership": ["leadership", "led a team", "team lead"],
    "Time Management": ["time management", "prioritize", "multitasking"],
    "Customer Service": ["customer service", "client facing", "customer-facing"],
    "Bilingual (English/French)": ["bilingual", "french"],
}

# Short aliases that are also common English words / letters need exact
# case-sensitive matching to avoid false positives.
_CASE_SENSITIVE = {"go": "Go", "r": "R", "c": "C", "ts": "TS", "js": "JS", "ml": "ML", "qa": "QA", "rag": "RAG", "ux": "UX", "ios": "iOS"}

_PATTERNS: list[tuple[str, re.Pattern[str]]] = []
for _skill, _aliases in SKILL_ALIASES.items():
    for _alias in _aliases:
        flags = 0 if _alias in _CASE_SENSITIVE else re.IGNORECASE
        literal = _CASE_SENSITIVE.get(_alias, _alias)
        _PATTERNS.append((_skill, re.compile(r"(?<![\w+#.])" + re.escape(literal) + r"(?![\w+#])", flags)))

_EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
_PHONE_RE = re.compile(r"(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}")
_YEARS_RE = re.compile(r"(\d{1,2})\+?\s*(?:years?|yrs?)", re.IGNORECASE)

CANADIAN_PROVINCES = {
    "ON": "Ontario", "QC": "Quebec", "BC": "British Columbia", "AB": "Alberta",
    "MB": "Manitoba", "SK": "Saskatchewan", "NS": "Nova Scotia", "NB": "New Brunswick",
    "NL": "Newfoundland and Labrador", "PE": "Prince Edward Island",
    "NT": "Northwest Territories", "YT": "Yukon", "NU": "Nunavut",
}
CANADIAN_CITIES = [
    "Ottawa", "Toronto", "Montreal", "Vancouver", "Calgary", "Edmonton", "Winnipeg",
    "Quebec City", "Hamilton", "Kitchener", "Waterloo", "London", "Halifax", "Victoria",
    "Saskatoon", "Regina", "Mississauga", "Brampton", "Markham", "Gatineau", "Kanata",
    "Burnaby", "Surrey", "Oakville", "Windsor", "Kingston", "Guelph", "Barrie",
    "St. John's", "Fredericton", "Moncton", "Charlottetown", "Whitehorse", "Yellowknife",
]
_CITY_TO_PROVINCE = {
    "Ottawa": "Ontario", "Toronto": "Ontario", "Hamilton": "Ontario", "Kitchener": "Ontario",
    "Waterloo": "Ontario", "London": "Ontario", "Mississauga": "Ontario", "Brampton": "Ontario",
    "Markham": "Ontario", "Kanata": "Ontario", "Oakville": "Ontario", "Windsor": "Ontario",
    "Kingston": "Ontario", "Guelph": "Ontario", "Barrie": "Ontario",
    "Montreal": "Quebec", "Quebec City": "Quebec", "Gatineau": "Quebec",
    "Vancouver": "British Columbia", "Victoria": "British Columbia", "Burnaby": "British Columbia",
    "Surrey": "British Columbia", "Calgary": "Alberta", "Edmonton": "Alberta",
    "Winnipeg": "Manitoba", "Saskatoon": "Saskatchewan", "Regina": "Saskatchewan",
    "Halifax": "Nova Scotia", "St. John's": "Newfoundland and Labrador",
    "Fredericton": "New Brunswick", "Moncton": "New Brunswick",
    "Charlottetown": "Prince Edward Island", "Whitehorse": "Yukon",
    "Yellowknife": "Northwest Territories",
}


def normalize_text(text: str) -> str:
    text = (text or "").replace("\r\n", "\n").replace(" ", " ")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def extract_skills(text: str) -> list[str]:
    """Return canonical skills found in the text, most mentioned first."""
    counts: Counter[str] = Counter()
    for skill, pattern in _PATTERNS:
        hits = len(pattern.findall(text or ""))
        if hits:
            counts[skill] += hits
    return [skill for skill, _ in counts.most_common()]


def extract_contact(text: str) -> dict[str, str | None]:
    email = _EMAIL_RE.search(text or "")
    phone = _PHONE_RE.search(text or "")
    return {"email": email.group(0) if email else None, "phone": phone.group(0) if phone else None}


def extract_years_experience(text: str) -> int | None:
    years = [int(m) for m in _YEARS_RE.findall(text or "") if int(m) < 40]
    return max(years) if years else None


def extract_location(text: str) -> dict[str, str | None]:
    """Find the first Canadian city / province mentioned."""
    city = None
    for name in CANADIAN_CITIES:
        if re.search(r"\b" + re.escape(name) + r"\b", text or ""):
            city = name
            break
    province = _CITY_TO_PROVINCE.get(city or "")
    if not province:
        for code, full in CANADIAN_PROVINCES.items():
            if re.search(r"\b" + re.escape(full) + r"\b", text or "") or re.search(
                r",\s*" + code + r"\b", text or ""
            ):
                province = full
                break
    return {"city": city, "province": province}


def guess_title_and_company(text: str) -> dict[str, str | None]:
    """Best-effort guess of the job title and company from a posting."""
    lines = [l.strip() for l in (text or "").splitlines() if l.strip()]
    title = company = None
    for line in lines[:15]:
        m = re.match(r"(?i)^(job\s*title|position|role)\s*[:\-]\s*(.+)$", line)
        if m:
            title = m.group(2).strip()
        m = re.match(r"(?i)^(company|employer|organization)\s*[:\-]\s*(.+)$", line)
        if m:
            company = m.group(2).strip()
    if not title and lines:
        title = lines[0][:120]
    if not company:
        m = re.search(r"(?i)\b(?:at|join)\s+([A-Z][\w&.\- ]{1,40}?)(?:[,.!\n]| is | we )", text or "")
        if m:
            company = m.group(1).strip()
    return {"title": title, "company": company}


def split_sections(text: str) -> dict[str, str]:
    """Split a resume into its common sections."""
    headers = {
        "summary": r"summary|profile|objective|about me",
        "skills": r"skills|technical skills|core competencies",
        "experience": r"experience|work experience|employment|work history",
        "education": r"education|academic",
        "projects": r"projects|personal projects",
        "certifications": r"certifications?|licenses?",
    }
    sections: dict[str, list[str]] = {"header": []}
    current = "header"
    for line in (text or "").splitlines():
        stripped = line.strip().strip(":").strip("#").strip()
        matched = next(
            (key for key, rx in headers.items() if re.fullmatch(f"(?i)({rx})", stripped)), None
        )
        if matched:
            current = matched
            sections.setdefault(current, [])
        else:
            sections.setdefault(current, []).append(line)
    return {k: "\n".join(v).strip() for k, v in sections.items() if "\n".join(v).strip()}


def analyse_document(text: str, kind: str = "resume") -> dict:
    """Full C1 analysis for a resume or job posting."""
    text = normalize_text(text)
    result: dict = {
        "kind": kind,
        "skills": extract_skills(text),
        "word_count": len(text.split()),
        "location": extract_location(text),
    }
    if kind == "resume":
        result["contact"] = extract_contact(text)
        result["sections"] = list(split_sections(text).keys())
    else:
        result.update(guess_title_and_company(text))
        result["years_experience_required"] = extract_years_experience(text)
    return result


def compare_skills(resume_skills: list[str], posting_skills: list[str]) -> dict:
    """Matching and missing skills + a simple match score (0-100)."""
    resume_set = {s.lower() for s in resume_skills}
    matched = [s for s in posting_skills if s.lower() in resume_set]
    missing = [s for s in posting_skills if s.lower() not in resume_set]
    extra = [s for s in resume_skills if s.lower() not in {p.lower() for p in posting_skills}]
    score = round(100 * len(matched) / len(posting_skills)) if posting_skills else 0
    return {"matched": matched, "missing": missing, "extra": extra, "score": score}
