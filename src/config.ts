export function loadConfig() {
  return {
    port: parseInt(process.env.PORT ?? "15345", 10),
    gelDSN: process.env.GEL_DSN ?? "gel://admin@uz-gel/main?tls_security=insecure",
    skillsDir: process.env.SKILLS_DIR ?? "/data/skills",
  }
}
