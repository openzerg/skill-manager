import type { ConnectRouter } from "@connectrpc/connect"
import { SkillManagerService } from "@openzerg/common/gen/skillmanager/v1_pb.js"
import type { GelClient } from "@openzerg/common/gel"
import { registerSkillHandlers } from "./handlers/skill.js"

export function createSkillManagerRouter(gel: GelClient, skillsDir: string): (router: ConnectRouter) => void {
  return (router: ConnectRouter) => {
    const skill = registerSkillHandlers(gel, skillsDir)
    router.service(SkillManagerService, { ...skill })
  }
}
