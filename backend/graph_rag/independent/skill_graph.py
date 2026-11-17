"""
C4 - Skill graph (in-memory version).

Same data model as the Neo4j graph that will be set up later:

    (:Skill)-[:RELATED_TO {reason}]->(:Skill)
    (:JobTitle)-[:REQUIRES]->(:Skill)

Until Neo4j is ready, this in-memory graph answers the same questions, so the
rest of the app works today. database/neo4j_seed.cypher is generated from
the same SEED data, so both stay in sync.
"""
from __future__ import annotations

from collections import defaultdict

# (skill_a, skill_b, reason) - undirected relations
SKILL_RELATIONS: list[tuple[str, str, str]] = [
    ("JavaScript", "TypeScript", "superset language"),
    ("JavaScript", "React", "framework built on"),
    ("JavaScript", "Node.js", "runtime for"),
    ("JavaScript", "Vue", "framework built on"),
    ("JavaScript", "Angular", "framework built on"),
    ("TypeScript", "Angular", "default language of"),
    ("React", "React Native", "same component model"),
    ("React", "Next.js", "framework built on"),
    ("React Native", "Expo", "toolchain for"),
    ("React Native", "Mobile Development", "used for"),
    ("Flutter", "Mobile Development", "used for"),
    ("Kotlin", "Mobile Development", "used for"),
    ("Swift", "Mobile Development", "used for"),
    ("Kotlin", "Java", "JVM language"),
    ("Node.js", "Express", "framework built on"),
    ("Python", "Django", "framework built on"),
    ("Python", "Flask", "framework built on"),
    ("Python", "FastAPI", "framework built on"),
    ("Python", "Pandas", "library for"),
    ("Python", "Machine Learning", "main language for"),
    ("Pandas", "Data Analysis", "used for"),
    ("NumPy", "Pandas", "foundation of"),
    ("Data Analysis", "SQL", "commonly uses"),
    ("Data Analysis", "Excel", "commonly uses"),
    ("Data Analysis", "Data Visualization", "commonly uses"),
    ("Data Analysis", "Statistics", "based on"),
    ("Machine Learning", "Scikit-learn", "library for"),
    ("Machine Learning", "Deep Learning", "subfield"),
    ("Deep Learning", "PyTorch", "framework for"),
    ("Deep Learning", "TensorFlow", "framework for"),
    ("Deep Learning", "Computer Vision", "applied in"),
    ("Deep Learning", "NLP", "applied in"),
    ("NLP", "LLM", "includes"),
    ("LLM", "Hugging Face", "models from"),
    ("LLM", "RAG", "technique for"),
    ("LLM", "LangChain", "framework for"),
    ("RAG", "Neo4j", "graph store for"),
    ("Computer Vision", "OpenCV", "library for"),
    ("Java", "Spring Boot", "framework built on"),
    ("C#", ".NET", "framework for"),
    ("Java", "Object-Oriented Programming", "uses"),
    ("C#", "Object-Oriented Programming", "uses"),
    ("C++", "Object-Oriented Programming", "uses"),
    ("Python", "Object-Oriented Programming", "uses"),
    ("SQL", "PostgreSQL", "query language of"),
    ("SQL", "MySQL", "query language of"),
    ("SQL", "SQL Server", "query language of"),
    ("SQL", "Oracle", "query language of"),
    ("SQL", "SQLite", "query language of"),
    ("PostgreSQL", "MySQL", "similar relational database"),
    ("MongoDB", "Firebase", "NoSQL database"),
    ("REST API", "GraphQL", "API style"),
    ("REST API", "FastAPI", "built with"),
    ("REST API", "Express", "built with"),
    ("REST API", "Microservices", "communication for"),
    ("Docker", "Kubernetes", "orchestrated by"),
    ("Docker", "CI/CD", "used in"),
    ("Docker", "Linux", "runs on"),
    ("AWS", "Azure", "cloud platform"),
    ("AWS", "Google Cloud", "cloud platform"),
    ("Azure", "Google Cloud", "cloud platform"),
    ("Terraform", "AWS", "provisions"),
    ("CI/CD", "Git", "triggered by"),
    ("Linux", "Bash", "scripted with"),
    ("Windows Server", "PowerShell", "scripted with"),
    ("Linux", "Networking", "administered with"),
    ("Networking", "Cybersecurity", "foundation of"),
    ("Technical Support", "Networking", "requires"),
    ("Technical Support", "Customer Service", "requires"),
    ("QA Testing", "Unit Testing", "testing practice"),
    ("Unit Testing", "CI/CD", "runs in"),
    ("HTML", "CSS", "used together"),
    ("CSS", "Tailwind CSS", "framework for"),
    ("CSS", "Bootstrap", "framework for"),
    ("JavaScript", "jQuery", "library for"),
    ("UI/UX Design", "CSS", "implemented with"),
    ("Agile", "Teamwork", "requires"),
    ("Leadership", "Teamwork", "builds on"),
    ("Communication", "Customer Service", "core of"),
    ("Problem Solving", "Technical Support", "core of"),
]

JOB_TITLES: dict[str, list[str]] = {
    "Software Developer": ["Python", "Java", "JavaScript", "Git", "SQL", "REST API", "Unit Testing", "Agile", "Object-Oriented Programming"],
    "Frontend Developer": ["JavaScript", "TypeScript", "React", "HTML", "CSS", "Git", "REST API", "UI/UX Design"],
    "Backend Developer": ["Python", "Java", "Node.js", "SQL", "PostgreSQL", "REST API", "Docker", "Git", "Microservices"],
    "Full Stack Developer": ["JavaScript", "React", "Node.js", "SQL", "REST API", "Git", "Docker", "HTML", "CSS"],
    "Mobile Developer": ["React Native", "Flutter", "Kotlin", "Swift", "Mobile Development", "REST API", "Git"],
    "Data Analyst": ["SQL", "Excel", "Python", "Data Analysis", "Data Visualization", "Statistics", "Communication"],
    "Data Scientist": ["Python", "Machine Learning", "Statistics", "Pandas", "SQL", "Deep Learning", "Data Visualization"],
    "Machine Learning Engineer": ["Python", "Machine Learning", "Deep Learning", "PyTorch", "TensorFlow", "Docker", "LLM"],
    "AI Developer": ["Python", "LLM", "RAG", "Hugging Face", "NLP", "LangChain", "REST API"],
    "DevOps Engineer": ["Linux", "Docker", "Kubernetes", "CI/CD", "AWS", "Terraform", "Bash", "Git"],
    "Cloud Engineer": ["AWS", "Azure", "Google Cloud", "Terraform", "Docker", "Linux", "Networking"],
    "QA Analyst": ["QA Testing", "Unit Testing", "Agile", "SQL", "Communication", "Problem Solving"],
    "IT Support Specialist": ["Technical Support", "Windows Server", "Networking", "Customer Service", "Problem Solving", "Communication"],
    "Network Administrator": ["Networking", "Linux", "Windows Server", "Cybersecurity", "PowerShell", "Bash"],
    "Cybersecurity Analyst": ["Cybersecurity", "Networking", "Linux", "Python", "Problem Solving"],
    "Database Administrator": ["SQL", "PostgreSQL", "SQL Server", "Oracle", "Linux", "Bash"],
}


class SkillGraph:
    backend_name = "in-memory"

    def __init__(self) -> None:
        self._adj: dict[str, dict[str, str]] = defaultdict(dict)
        for a, b, reason in SKILL_RELATIONS:
            self._adj[a.lower()][b] = reason
            self._adj[b.lower()][a] = reason
        self._titles = {t.lower(): (t, skills) for t, skills in JOB_TITLES.items()}

    def neighbours(self, skill: str) -> dict[str, str]:
        return dict(self._adj.get(skill.lower(), {}))

    def related_skills_for_gap(
        self, candidate_skills: list[str], missing_skills: list[str]
    ) -> list[dict]:
        """For each missing skill, which skills the candidate HAS are related to it."""
        have = {s.lower(): s for s in candidate_skills}
        out = []
        for missing in missing_skills:
            for neighbour, reason in self.neighbours(missing).items():
                if neighbour.lower() in have:
                    out.append(
                        {"missing": missing, "related_skill_you_have": have[neighbour.lower()], "relation": reason}
                    )
        return out

    def skills_for_title(self, title: str) -> dict:
        """Best-matching known job title for a posting title, and its skills."""
        t = (title or "").lower()
        best, best_score = None, 0
        for key, (name, skills) in self._titles.items():
            words = set(key.split())
            score = sum(1 for w in words if w in t)
            if key in t:
                score += 10
            if score > best_score:
                best, best_score = (name, skills), score
        return {"title": best[0], "skills": best[1]} if best else {"title": None, "skills": []}

    def subgraph(self, skills: list[str], depth: int = 1) -> dict:
        """Nodes + edges around a set of skills (used by the UI to draw the graph)."""
        nodes = {s for s in skills}
        edges = []
        frontier = set(skills)
        for _ in range(depth):
            nxt = set()
            for s in frontier:
                for n, reason in self.neighbours(s).items():
                    edges.append({"source": s, "target": n, "relation": reason})
                    if n not in nodes:
                        nxt.add(n)
            nodes |= nxt
            frontier = nxt
        unique = {(min(e["source"], e["target"]), max(e["source"], e["target"])): e for e in edges}
        return {"nodes": sorted(nodes), "edges": list(unique.values())}


def to_cypher() -> str:
    """Cypher script that loads the same seed data into Neo4j."""
    lines = ["// Generated by backend/graph_rag/independent/skill_graph.py", "CREATE CONSTRAINT skill_name IF NOT EXISTS FOR (s:Skill) REQUIRE s.name IS UNIQUE;",
             "CREATE CONSTRAINT title_name IF NOT EXISTS FOR (t:JobTitle) REQUIRE t.name IS UNIQUE;"]
    esc = lambda s: s.replace("\\", "\\\\").replace("'", "\\'")  # noqa: E731
    for a, b, reason in SKILL_RELATIONS:
        lines.append(
            f"MERGE (a:Skill {{name:'{esc(a)}'}}) MERGE (b:Skill {{name:'{esc(b)}'}}) "
            f"MERGE (a)-[:RELATED_TO {{reason:'{esc(reason)}'}}]->(b);"
        )
    for title, skills in JOB_TITLES.items():
        for s in skills:
            lines.append(
                f"MERGE (t:JobTitle {{name:'{esc(title)}'}}) MERGE (s:Skill {{name:'{esc(s)}'}}) MERGE (t)-[:REQUIRES]->(s);"
            )
    return "\n".join(lines) + "\n"
