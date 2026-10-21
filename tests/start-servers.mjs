import { spawn } from "child_process";
import { startMockServer } from "./mock-api-server.mjs";

const MOCK_PORT = 9999;
const NEXT_PORT = 3100;

async function main() {
  // Start mock API server in the same process to avoid Windows spawn issues
  await startMockServer(MOCK_PORT);
  console.log("Mock API server is ready.");

  // Start Next.js production server
  const nextServer = spawn(
    "npm",
    ["run", "start", "--", "-p", String(NEXT_PORT)],
    {
      stdio: "inherit",
      env: { ...process.env, MOVIES_API_ORIGIN: "http://localhost:" + MOCK_PORT },
      shell: true,
    }
  );

  nextServer.on("exit", (code) => {
    process.exit(code || 0);
  });
}

main().catch((err) => {
  console.error("Failed to start servers:", err);
  process.exit(1);
});