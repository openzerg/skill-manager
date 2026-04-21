import { readFile } from "node:fs/promises"
import { rmSync } from "node:fs"
import { join } from "node:path"
import { ok, err, ResultAsync } from "neverthrow"
import { ConflictError, NotFoundError, ValidationError, DbError, AppError } from "@openzerg/common"
import { gelQuery, unwrap, type GelClient } from "@openzerg/common/gel"
import {
  listAllSkills,
  getSkillBySlug,
  checkSkillSlugExists,
  getSkillForDelete,
  insertSkill,
  updateSkillById,
  deleteSkillById,
} from "@openzerg/common/queries"
import { parseFrontmatter } from "../frontmatter.js"
import { gitClone, gitPull, gitRevParse } from "../git.js"
import type {
  RegisterSkillRequest,
  UpdateSkillRequest,
  DeleteSkillRequest,
  GetSkillRequest,
} from "@openzerg/common/gen/skillmanager/v1_pb.js"

type SkillRow = {
  id: string
  slug: string
  name: string
  description: string
  gitUrl: string
  localPath: string
  commitHash: string
  pkgs: string
  createdAt: number
  updatedAt: number
}

function skillToInfo(s: SkillRow) {
  return {
    id: s.id,
    slug: s.slug,
    name: s.name,
    description: s.description,
    gitUrl: s.gitUrl,
    localPath: s.localPath,
    commitHash: s.commitHash,
    pkgs: s.pkgs,
    createdAt: BigInt(s.createdAt),
    updatedAt: BigInt(s.updatedAt),
  }
}

export function registerSkillHandlers(gel: GelClient, skillsDir: string) {
  return {

    registerSkill(req: RegisterSkillRequest) {
      return unwrap(
        gelQuery(() => checkSkillSlugExists(gel, { slug: req.slug }))
          .andThen(existing =>
            existing
              ? err(new ConflictError(`Skill already exists: ${req.slug}`))
              : ok(undefined)
          )
          .andThen(() => ResultAsync.fromPromise(
            (async () => {
              const localPath = join(skillsDir, req.slug)
              await gitClone(req.gitUrl, localPath)
              const mdRaw = await readFile(join(localPath, "SKILL.md"), "utf-8")
              const fm = parseFrontmatter(mdRaw)
              if (!fm) throw new ValidationError("Failed to parse SKILL.md frontmatter")
              const commitHash = await gitRevParse(localPath)
              return { localPath, fm, commitHash }
            })(),
            (e): AppError => e instanceof AppError ? e : new DbError(e instanceof Error ? e.message : String(e))
          ))
          .andThen(({ localPath, fm, commitHash }) => {
            const ts = Date.now()
            return gelQuery(() => insertSkill(gel, {
              slug: req.slug,
              name: fm.name,
              description: fm.description ?? "",
              gitUrl: req.gitUrl,
              localPath,
              commitHash,
              pkgs: JSON.stringify(fm.pkgs),
              createdAt: ts,
              updatedAt: ts,
            }))
          })
          .andThen(row =>
            row
              ? ok({ skill: skillToInfo(row) })
              : err(new DbError("Insert returned no row"))
          )
      )
    },

    updateSkill(req: UpdateSkillRequest) {
      return unwrap(
        gelQuery(() => getSkillBySlug(gel, { slug: req.slug }))
          .andThen(row =>
            row ? ok(row) : err(new NotFoundError(`Skill not found: ${req.slug}`))
          )
          .andThen(row => ResultAsync.fromPromise(
            (async () => {
              await gitPull(row.localPath)
              const mdRaw = await readFile(join(row.localPath, "SKILL.md"), "utf-8")
              const fm = parseFrontmatter(mdRaw)
              if (!fm) throw new ValidationError("Failed to parse SKILL.md frontmatter after pull")
              const commitHash = await gitRevParse(row.localPath)
              return { row, fm, commitHash }
            })(),
            (e): AppError => e instanceof AppError ? e : new DbError(e instanceof Error ? e.message : String(e))
          ))
          .andThen(({ row, fm, commitHash }) => {
            const ts = Date.now()
            return gelQuery(() => updateSkillById(gel, {
              id: row.id,
              name: fm.name,
              description: fm.description ?? "",
              commitHash,
              pkgs: JSON.stringify(fm.pkgs),
              updatedAt: ts,
            }))
          })
          .andThen(updated =>
            updated
              ? ok({ skill: skillToInfo(updated) })
              : err(new DbError("Update returned no row"))
          )
      )
    },

    deleteSkill(req: DeleteSkillRequest) {
      return unwrap(
        gelQuery(() => getSkillForDelete(gel, { slug: req.slug }))
          .andThen(row =>
            row ? ok(row) : err(new NotFoundError(`Skill not found: ${req.slug}`))
          )
          .andThen(row => ResultAsync.fromPromise(
            (async () => {
              rmSync(row.localPath, { recursive: true, force: true })
              await deleteSkillById(gel, { id: row.id })
              return {}
            })(),
            (e): AppError => new DbError(e instanceof Error ? e.message : String(e))
          ))
      )
    },

    listSkills() {
      return unwrap(
        gelQuery(() => listAllSkills(gel))
          .map(rows => ({ skills: rows.map(skillToInfo) }))
      )
    },

    getSkill(req: GetSkillRequest) {
      return unwrap(
        gelQuery(() => getSkillBySlug(gel, { slug: req.slug }))
          .andThen(row =>
            row ? ok(skillToInfo(row)) : err(new NotFoundError(`Skill not found: ${req.slug}`))
          )
      )
    },

  }
}
