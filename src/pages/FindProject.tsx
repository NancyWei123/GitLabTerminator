import { useState } from "react";
import { useNavigate } from "react-router-dom";

type GitLabProject = {
  id: number;
  name: string;
  path_with_namespace: string;
  description: string | null;
  web_url: string;
  star_count: number;
  forks_count: number;
  last_activity_at: string;
  default_branch?: string;
  topics?: string[];
};

function FindProject() {
  const navigate = useNavigate();

  const [keyword, setKeyword] = useState("");
  const [techStack, setTechStack] = useState("");
  const [level, setLevel] = useState("1");
  const [minStars, setMinStars] = useState("0");

  const [projects, setProjects] = useState<GitLabProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const getLevelText = (value: string) => {
    switch (value) {
      case "1":
        return "Beginner";
      case "2":
        return "Easy";
      case "3":
        return "Intermediate";
      case "4":
        return "Advanced";
      case "5":
        return "Expert";
      default:
        return "Beginner";
    }
  };

  const findProjects = async () => {
    if (!keyword.trim() && !techStack.trim()) {
      setError("Please enter a keyword or technology stack.");
      return;
    }

    const minStarNumber = Number(minStars);

    if (Number.isNaN(minStarNumber) || minStarNumber < 0) {
      setError("Minimum stars must be 0 or above.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setProjects([]);

      const searchText = `${keyword} ${techStack} ${getLevelText(level)}`.trim();

      const response = await fetch(
        `https://gitlab.com/api/v4/projects?search=${encodeURIComponent(
          searchText
        )}&simple=true&per_page=50&order_by=star_count&sort=desc`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch GitLab projects.");
      }

      const data: GitLabProject[] = await response.json();

      const filteredProjects = data
        .filter((project) => project.star_count >= minStarNumber)
        .slice(0, 12);

      setProjects(filteredProjects);

      if (filteredProjects.length === 0) {
        setError("No projects found. Try lowering the minimum stars.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const analyseProject = (project: GitLabProject) => {
    const searchText = `${keyword} ${techStack}`.trim();
    const levelText = getLevelText(level);

    navigate("/understand-project", {
      state: {
        project,
        repoUrl: project.web_url,
        projectId: project.id,
        level,
        levelText,
        keyword,
        techStack,
        searchText,
        minStars,
      },
    });
  };

  return (
    <section className="find-project-page">
      <div className="find-project-hero">
        <span className="page-badge">PROJECT DISCOVERY</span>

        <h1>Find a suitable GitLab project</h1>

        <p>
          Search by keyword, technology stack, technology level, and minimum
          stars. Then click Analyse Project to understand the repository.
        </p>
      </div>

      <div className="find-project-card">
        <div className="form-grid">
          <div className="form-group">
            <label>Keyword</label>
            <input
              type="text"
              placeholder="Example: task manager, AI chatbot, e-commerce"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Technology Stack</label>
            <input
              type="text"
              placeholder="Example: React, Vue, Spring Boot, Python"
              value={techStack}
              onChange={(e) => setTechStack(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Technology Level</label>
            <select value={level} onChange={(e) => setLevel(e.target.value)}>
              <option value="1">1 - Beginner</option>
              <option value="2">2 - Easy</option>
              <option value="3">3 - Intermediate</option>
              <option value="4">4 - Advanced</option>
              <option value="5">5 - Expert</option>
            </select>
          </div>

          <div className="form-group">
            <label>Minimum Stars</label>
            <input
              type="number"
              min="0"
              placeholder="Example: 10"
              value={minStars}
              onChange={(e) => setMinStars(e.target.value)}
            />
          </div>
        </div>

        <div className="level-preview">
          <span>Selected filters:</span>
          <strong>
            Level {level} / 5 · {getLevelText(level)} · Stars ≥{" "}
            {minStars || 0}
          </strong>
        </div>

        {error && <p className="error-message">{error}</p>}

        <button
          className="find-button"
          onClick={findProjects}
          disabled={loading}
        >
          {loading ? "Searching..." : "Find Projects"}
        </button>
      </div>

      <div className="project-results">
        {projects.map((project) => (
          <div className="project-card" key={project.id}>
            <div className="project-card-header">
              <h3>{project.name}</h3>
              <span>{project.star_count} ★</span>
            </div>

            <p className="project-namespace">{project.path_with_namespace}</p>

            <p className="project-description">
              {project.description || "No description provided."}
            </p>

            <div className="project-meta">
              <span>Forks: {project.forks_count}</span>

              <span>
                Updated:{" "}
                {new Date(project.last_activity_at).toLocaleDateString()}
              </span>

              <span>
                Level: {level} / 5 · {getLevelText(level)}
              </span>

              <span>Stars: {project.star_count}</span>
            </div>

            <div className="project-actions">
              <a
                className="project-link"
                href={project.web_url}
                target="_blank"
                rel="noreferrer"
              >
                Open GitLab
              </a>

              <button
                className="analyse-button"
                onClick={() => analyseProject(project)}
              >
                Analyse Project
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default FindProject;