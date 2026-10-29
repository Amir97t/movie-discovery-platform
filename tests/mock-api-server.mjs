/**
 * Mock API server for deterministic E2E testing.
 *
 * Mimics https://moviesapi.codingfront.dev/api/v1 with canned responses.
 * Started by Playwright's webServer alongside the Next.js dev server.
 * The NEXT_PUBLIC_MOVIES_API_ORIGIN env var points the Next.js server at
 * this mock instead of the live API.
 */

import http from "http";

const PORT = parseInt(process.env.MOCK_API_PORT || "9999", 10);

function generateMovie(id, title, genre) {
  return {
    id: String(id),
    title: title,
    poster: `https://moviesapi.codingfront.dev/images/tt${id}.jpg`,
    imdb_rating: "8.0",
    released: "2020-01-01",
    runtime: "120 min",
    genres: [genre],
    plot: `Plot for ${title}`,
    images: [`https://moviesapi.codingfront.dev/images/tt${id}_backdrop.jpg`],
    director: "Director",
    actors: "Actor 1, Actor 2",
    country: "United States",
    imdb_id: `tt${id}`,
    website: "N/A",
  };
}

// Canonical movie records used across all mock responses.
const MOVIE_1 = generateMovie(1, "The Shawshank Redemption", "Drama");
const MOVIE_250 = generateMovie(250, "Movie 250", "Drama");

const ALL_MOVIES = Array.from({ length: 25 }, (_, i) => {
  if (i === 0) return MOVIE_1;
  if (i === 24) return MOVIE_250;
  return generateMovie(i + 1, `Movie ${i + 1}`, i % 2 === 0 ? "Drama" : "Action");
});

// Sci-Fi movies: 13 total, so page 1 (per_page=12) has 12, page 2 has 1
const SCI_FI_MOVIES = [
  generateMovie(101, "Blade Runner 2049", "Sci-Fi"),
  generateMovie(102, "The Matrix", "Sci-Fi"),
  generateMovie(103, "Inception", "Sci-Fi"),
  generateMovie(104, "Interstellar", "Sci-Fi"),
  generateMovie(105, "The Terminator", "Sci-Fi"),
  generateMovie(106, "Alien", "Sci-Fi"),
  generateMovie(107, "Predator", "Sci-Fi"),
  generateMovie(108, "RoboCop", "Sci-Fi"),
  generateMovie(109, "Starship Troopers", "Sci-Fi"),
  generateMovie(110, "The Fifth Element", "Sci-Fi"),
  generateMovie(111, "Back to the Future", "Sci-Fi"),
  generateMovie(112, "E.T. the Extra-Terrestrial", "Sci-Fi"),
  generateMovie(113, "Close Encounters of the Third Kind", "Sci-Fi"),
];

// Crime movies: 2 total
const CRIME_MOVIES = [
  generateMovie(201, "The Godfather", "Crime"),
  generateMovie(202, "Pulp Fiction", "Crime"),
];

function jsonResponse(res, statusCode, body) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(JSON.stringify(body));
}

function createServer() {
  return http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      });
      res.end();
      return;
    }

    if (req.method !== "GET") {
      jsonResponse(res, 405, { error: "Method not allowed" });
      return;
    }

    // GET /api/v1/movies?page=N
    const moviesListMatch = url.pathname.match(/^\/api\/v1\/movies$/);
    if (moviesListMatch && req.method === "GET") {
      const page = parseInt(url.searchParams.get("page") || "1", 10);
      const start = (page - 1) * 12;
      const pageMovies = ALL_MOVIES.slice(start, start + 12);
      jsonResponse(res, 200, {
        data: pageMovies,
        metadata: {
          current_page: String(page),
          per_page: "12",
          page_count: String(Math.ceil(ALL_MOVIES.length / 12)),
          total_count: String(ALL_MOVIES.length),
        },
      });
      return;
    }

    // GET /api/v1/movies/{id}
    const movieDetailMatch = url.pathname.match(/^\/api\/v1\/movies\/([^/]+)$/);
    if (movieDetailMatch && req.method === "GET") {
      const id = movieDetailMatch[1];
      if (id === "999") {
        jsonResponse(res, 404, { error: "Movie not found" });
        return;
      }
      if (id === "500") {
        jsonResponse(res, 500, { error: "Internal server error" });
        return;
      }
      const found = ALL_MOVIES.find((m) => m.id === id);
      if (found) {
        jsonResponse(res, 200, found);
        return;
      }
      if (id === "1") {
        jsonResponse(res, 200, MOVIE_1);
        return;
      }
      if (id === "250") {
        jsonResponse(res, 200, MOVIE_250);
        return;
      }
      jsonResponse(res, 404, { error: "Movie not found" });
      return;
    }

    // GET /api/v1/genres/{name}/movies?page=N
    const genreMatch = url.pathname.match(/^\/api\/v1\/genres\/([^/]+)\/movies$/);
    if (genreMatch && req.method === "GET") {
      const genreName = decodeURIComponent(genreMatch[1]);
      const page = parseInt(url.searchParams.get("page") || "1", 10);

      let genreMovies = [];
      if (genreName === "Sci-Fi") genreMovies = SCI_FI_MOVIES;
      if (genreName === "Crime") genreMovies = CRIME_MOVIES;

      const start = (page - 1) * 12;
      const pageMovies = genreMovies.slice(start, start + 12);
      jsonResponse(res, 200, {
        data: pageMovies,
        metadata: {
          current_page: String(page),
          per_page: "12",
          page_count: String(Math.ceil(genreMovies.length / 12)),
          total_count: String(genreMovies.length),
        },
      });
      return;
    }

    jsonResponse(res, 404, { error: "Not found" });
  });
}

export function startMockServer(port = PORT) {
  const server = createServer();
  return new Promise((resolve) => {
    server.listen(port, () => {
      console.log(`Mock API server listening on port ${port}`);
      resolve(server);
    });
  });
}

// Allow running directly with `node tests/mock-api-server.mjs`
if (import.meta.url === `file://${process.argv[1]}`) {
  startMockServer();
}