"""
C4 - Graph RAG service.

Uses Neo4j when NEO4J_URI is set and reachable; otherwise the in-memory
skill graph. Both expose the same methods.
"""
from __future__ import annotations

import logging
from functools import lru_cache

from backend.graph_rag.independent.skill_graph import SkillGraph
from configuration.settings import settings

log = logging.getLogger("irish.graph")


class Neo4jSkillGraph(SkillGraph):
    backend_name = "neo4j"

    def __init__(self, uri: str, user: str, password: str) -> None:
        super().__init__()
        from neo4j import GraphDatabase

        self._driver = GraphDatabase.driver(uri, auth=(user, password))
        self._driver.verify_connectivity()

    def neighbours(self, skill: str) -> dict[str, str]:
        query = (
            "MATCH (s:Skill)-[r:RELATED_TO]-(n:Skill) "
            "WHERE toLower(s.name) = toLower($name) RETURN n.name AS name, r.reason AS reason"
        )
        with self._driver.session() as session:
            return {rec["name"]: rec["reason"] for rec in session.run(query, name=skill)}

    def skills_for_title(self, title: str) -> dict:
        query = (
            "MATCH (t:JobTitle)-[:REQUIRES]->(s:Skill) "
            "WHERE toLower($title) CONTAINS toLower(t.name) "
            "RETURN t.name AS title, collect(s.name) AS skills ORDER BY size(t.name) DESC LIMIT 1"
        )
        with self._driver.session() as session:
            rec = session.run(query, title=title or "").single()
        return {"title": rec["title"], "skills": rec["skills"]} if rec else super().skills_for_title(title)


@lru_cache(maxsize=1)
def get_graph() -> SkillGraph:
    if settings.neo4j_uri:
        try:
            return Neo4jSkillGraph(settings.neo4j_uri, settings.neo4j_user, settings.neo4j_password)
        except Exception as exc:  # noqa: BLE001 - any connection problem -> fallback
            log.warning("Neo4j unavailable (%s); using in-memory skill graph.", exc)
    return SkillGraph()
