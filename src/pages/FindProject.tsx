import { useState } from "react";
import { useNavigate } from "react-router-dom";

type ProjectSource = "gitlab" | "github";

type Project = {
  source: ProjectSource;
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
  language?: string | null;
};

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

type GitHubRepo = {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  stargazers_count: number;
  forks_count: number;
  updated_at: string;
  default_branch?: string;
  topics?: string[];
  language?: string | null;
};

type GitHubSearchResponse = {
  items: GitHubRepo[];
  message?: string;
};

function FindProject() {
  const navigate = useNavigate();

  const [source, setSource] = useState<ProjectSource>("gitlab");
  const [keyword, setKeyword] = useState("");
  const [techStack, setTechStack] = useState("");
  const [level, setLevel] = useState("1");
  const [minStars, setMinStars] = useState("0");

  const [projects, setProjects] = useState<Project[]>([]);
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

  const mapGitLabProject = (project: GitLabProject): Project => {
    return {
      source: "gitlab",
      id: project.id,
      name: project.name,
      path_with_namespace: project.path_with_namespace,
      description: project.description,
      web_url: project.web_url,
      star_count: project.star_count,
      forks_count: project.forks_count,
      last_activity_at: project.last_activity_at,
      default_branch: project.default_branch,
      topics: project.topics,
    };
  };

  const mapGitHubRepo = (repo: GitHubRepo): Project => {
    return {
      source: "github",
      id: repo.id,
      name: repo.name,
      path_with_namespace: repo.full_name,
      description: repo.description,
      web_url: repo.html_url,
      star_count: repo.stargazers_count,
      forks_count: repo.forks_count,
      last_activity_at: repo.updated_at,
      default_branch: repo.default_branch,
      topics: repo.topics,
      language: repo.language,
    };
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

      let normalizedProjects: Project[] = [];

      if (source === "gitlab") {
        const searchText = `${keyword} ${techStack} ${getLevelText(
          level
        )}`.trim();

        const response = await fetch(
          `https://gitlab.com/api/v4/projects?search=${encodeURIComponent(
            searchText
          )}&simple=true&per_page=50&order_by=star_count&sort=desc`
        );

        if (!response.ok) {
          throw new Error("Failed to fetch GitLab projects.");
        }

        const data: GitLabProject[] = await response.json();
        normalizedProjects = data.map(mapGitLabProject);
      }

      if (source === "github") {
        const githubQuery = [
          keyword.trim(),
          techStack.trim(),
          getLevelText(level),
          minStarNumber > 0 ? `stars:>=${minStarNumber}` : "",
        ]
          .filter(Boolean)
          .join(" ");

        const response = await fetch(
          `https://api.github.com/search/repositories?q=${encodeURIComponent(
            githubQuery
          )}&sort=stars&order=desc&per_page=50`,
          {
            headers: {
              Accept: "application/vnd.github+json",
            },
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          throw new Error(
            errorData?.message || "Failed to fetch GitHub projects."
          );
        }

        const data: GitHubSearchResponse = await response.json();
        normalizedProjects = data.items.map(mapGitHubRepo);
      }

      const filteredProjects = normalizedProjects
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

  const analyseProject = (project: Project) => {
    const searchText = `${keyword} ${techStack}`.trim();
    const levelText = getLevelText(level);

    navigate("/understand-project", {
      state: {
        project,
        repoUrl: project.web_url,
        projectId: project.id,
        source: project.source,
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

        <h1>Find a suitable open-source project</h1>

        <p>
          Search GitLab or GitHub by keyword, technology stack, technology
          level, and minimum stars. Then click Analyse Project to understand the
          repository.
        </p>
      </div>

      <div className="find-project-card">
        <div className="form-grid">
          <div className="form-group">
            <label>Source</label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as ProjectSource)}
            >
              <option value="gitlab">GitLab</option>
              <option value="github">GitHub</option>
            </select>
          </div>

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
            {source === "github" ? "GitHub" : "GitLab"} · Level {level} / 5 ·{" "}
            {getLevelText(level)} · Stars ≥ {minStars || 0}
          </strong>
        </div>

        {error && <p className="error-message">{error}</p>}

        <button
          className="find-button"
          onClick={findProjects}
          disabled={loading}
        >
          {loading
            ? `Searching ${source === "github" ? "GitHub" : "GitLab"}...`
            : "Find Projects"}
        </button>
      </div>

      <div className="project-results">
        {projects.map((project) => (
          <div className="project-card" key={`${project.source}-${project.id}`}>
            <div className="project-card-header">
              <h3>{project.name}</h3>
              <span>{project.star_count} ★</span>
            </div>

            <p className="project-namespace">
              {project.path_with_namespace}
            </p>

            <p className="project-description">
              {project.description || "No description provided."}
            </p>

            <div className="project-meta">
              <span>
                Source: {project.source === "github" ? "GitHub" : "GitLab"}
              </span>

              <span>Forks: {project.forks_count}</span>

              {project.language && <span>Language: {project.language}</span>}

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
                Open {project.source === "github" ? "GitHub" : "GitLab"}
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