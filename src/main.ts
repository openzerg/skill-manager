import { createServer } from "node:http"
import { connectNodeAdapter } from "@connectrpc/connect-node"
import { loadConfig } from "./config.js"
import { createGelClient } from "@openzerg/common/gel"
import { createSkillManagerRouter } from "./router.js"

const cfg = loadConfig()

async function main() {
  const gel = createGelClient(cfg.gelDSN)

  const handler = connectNodeAdapter({
    routes: createSkillManagerRouter(gel, cfg.skillsDir),
  })

  createServer(handler).listen(cfg.port, () => {
    console.log(`skill-manager listening on :${cfg.port}`)
  })
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
