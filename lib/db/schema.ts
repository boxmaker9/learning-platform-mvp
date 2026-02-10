import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"

export const organizationRole = pgEnum("organization_role", ["admin", "student"])
export const problemType = pgEnum("problem_type", [
  "single_choice",
  "multiple_choice",
  "text",
])
export const invitationStatus = pgEnum("invitation_status", [
  "pending",
  "accepted",
  "revoked",
])

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  createdBy: uuid("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const organizationMembers = pgTable("organization_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull(),
  userId: uuid("user_id").notNull(),
  role: organizationRole("role").notNull().default("student"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const organizationInvitations = pgTable("organization_invitations", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull(),
  email: text("email").notNull(),
  role: organizationRole("role").notNull().default("student"),
  token: uuid("token").notNull().defaultRandom(),
  status: invitationStatus("status").notNull().default("pending"),
  createdBy: uuid("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  acceptedBy: uuid("accepted_by"),
})

export const courses = pgTable("courses", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  createdBy: uuid("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export const problems = pgTable("problems", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull(),
  courseId: uuid("course_id"),
  title: text("title").notNull(),
  prompt: text("prompt"),
  type: problemType("type").notNull(),
  answerText: text("answer_text"),
  explanation: text("explanation"),
  createdBy: uuid("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export const problemOptions = pgTable("problem_options", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull(),
  problemId: uuid("problem_id").notNull(),
  label: text("label").notNull(),
  position: integer("position").notNull().default(0),
  isCorrect: boolean("is_correct").notNull().default(false),
})

export const problemAttempts = pgTable("problem_attempts", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull(),
  problemId: uuid("problem_id").notNull(),
  userId: uuid("user_id").notNull(),
  selectedOptionIds: uuid("selected_option_ids").array(),
  answerText: text("answer_text"),
  isCorrect: boolean("is_correct"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

