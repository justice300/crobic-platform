import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CURRENT_YEAR = "2026";
const LECTURERS = [
  "PST Sunday",
  "PST Sam Owoseni",
  "PST Momoh",
  "PST Akinfemi",
  "PST Kolo James",
  "Peter Lasisi",
  "PST Femi Johnson",
  "PST Ubi David",
  "SIS Samirah Atukeke"
];

function slugUsername(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/\.+/g, ".")
    .replace(/^\.+|\.+$/g, "") || "lecturer";
}

function titlePasswordName(name) {
  return String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join("");
}

function lecturerEmail(username) {
  return `${username}@lecturer.cibi.local`;
}

function lecturerPassword(name) {
  return `${titlePasswordName(name)}@${CURRENT_YEAR}`;
}

function normalizeLecturerName(name) {
  const clean = String(name || "").trim().replace(/\s+/g, " ");
  const lower = clean.toLowerCase();
  if (["sis semira atukeke", "sis samira atukeke", "sis samirah atukeke"].includes(lower)) return "SIS Samirah Atukeke";
  if (lower === "pst ubi") return "PST Ubi David";
  return clean;
}

const PROGRAMMES = [
  {
    title: "Foundation Certificate Program",
    level: "Foundation",
    duration: "One-time programme",
    description: "Foundation certificate programme courses for CIBI students.",
    courses: [
      { title: "Tenets of Faith", stage: "Foundation", lecturer: "PST Sunday" },
      { title: "Use of English Language", stage: "Foundation", lecturer: "PST Sam Owoseni" },
      { title: "Character Development", stage: "Foundation", lecturer: "PST Momoh" },
      { title: "Understanding Prophetic and Deliverance Ministry", stage: "Foundation", lecturer: "PST Akinfemi" },
      { title: "Evangelism and Evangelist", stage: "Foundation", lecturer: "PST Kolo James" },
      { title: "Social Media and Digital Literacy", stage: "Foundation", lecturer: "Peter Lasisi" },
      { title: "Practical Prayer", stage: "Foundation", lecturer: "PST Femi Johnson" },
      { title: "Introduction to Bible History", stage: "Foundation", lecturer: "PST Ubi David" },
      { title: "Project", stage: "Foundation", allLecturers: true }
    ]
  },
  {
    title: "Diploma Certificate Program in Theology and Leadership",
    level: "Diploma",
    duration: "24 months",
    description: "Diploma Certificate Program in Theology and Leadership courses.",
    courses: [
      { title: "Introduction and Fundamental of Scripture Homiletics", stage: "100L First Semester", lecturer: "Peter Lasisi" },
      { title: "Introduction to Pneumatology", stage: "100L First Semester", lecturer: "PST Kolo James" },
      { title: "Introduction to Prophetic and Deliverance Ministry", stage: "100L First Semester", lecturer: "PST Akinfemi" },
      { title: "Integrity in Ministry: Character Development", stage: "100L First Semester", lecturer: "PST Momoh" },
      { title: "Ministerial Ethics 1", stage: "100L First Semester", lecturer: "" },
      { title: "Introduction to Biblical Hermeneutics, Origin and History of the Bible", stage: "100L First Semester", lecturer: "PST Ubi David" },
      { title: "Soteriology Simplified: Introduction, Definitions and Description", stage: "100L First Semester", lecturer: "SIS Samirah Atukeke" },
      { title: "Biblical Principles of Ministry", stage: "100L First Semester", lecturer: "" },
      { title: "Evangelism and Evangelist", stage: "100L First Semester", lecturer: "PST Kolo James" },
      { title: "Dynamics of Faith and Mental Exploit", stage: "100L First Semester", lecturer: "PST Sunday" },
      { title: "Dynamics of Prayer and Spiritual Warfare", stage: "100L First Semester", lecturer: "PST Femi Johnson" },
      { title: "Use of English Language", stage: "100L First Semester", lecturer: "PST Sam Owoseni" },
      { title: "Biblical Business Concept 1", stage: "100L First Semester", lecturer: "PST Sam Owoseni" },
      { title: "Leadership Strategy 1", stage: "100L First Semester", lecturer: "PST Momoh" },
      { title: "Social Media and Digital Literacy", stage: "100L First Semester", lecturer: "Peter Lasisi" },

      { title: "Homiletics Made Handy", stage: "100L Second Semester", lecturer: "Peter Lasisi" },
      { title: "Pneumatology", stage: "100L Second Semester", lecturer: "PST Kolo James" },
      { title: "Prophetic and Deliverance Ministry", stage: "100L Second Semester", lecturer: "PST Akinfemi" },
      { title: "Financial Integrity", stage: "100L Second Semester", lecturer: "PST Ubi David" },
      { title: "Biblical Business Concept", stage: "100L Second Semester", lecturer: "PST Sam Owoseni" },
      { title: "Biblical Hermeneutics Made Easy", stage: "100L Second Semester", lecturer: "PST Ubi David" },
      { title: "Soteriology Simplified", stage: "100L Second Semester", lecturer: "SIS Samirah Atukeke" },
      { title: "Evangelism and Evangelist", stage: "100L Second Semester", lecturer: "PST Kolo James" },
      { title: "Index of Excellence in Ministry", stage: "100L Second Semester", lecturer: "PST Momoh" },
      { title: "Dynamics of Faith and Mental Exploit", stage: "100L Second Semester", lecturer: "PST Sunday" },
      { title: "Dynamics of Prayer and Spiritual Warfare", stage: "100L Second Semester", lecturer: "PST Femi Johnson" },
      { title: "Use of English Language", stage: "100L Second Semester", lecturer: "PST Sam Owoseni" },
      { title: "Ministry of an Assistant Pastor", stage: "100L Second Semester", lecturer: "PST Momoh" },
      { title: "Social Media and Digital Literacy", stage: "100L Second Semester", lecturer: "Peter Lasisi" },

      { title: "Index of Excellence in Ministry", stage: "200L First Semester", lecturer: "PST Momoh" },
      { title: "Principle of Church Planting and Growth", stage: "200L First Semester", lecturer: "PST Momoh" },
      { title: "Soteriology Simplified", stage: "200L First Semester", lecturer: "SIS Samirah Atukeke" },
      { title: "Biblical Hermeneutics", stage: "200L First Semester", lecturer: "PST Ubi David" },
      { title: "Women in Ministry", stage: "200L First Semester", lecturer: "SIS Samirah Atukeke" },
      { title: "Homiletics Made Handy", stage: "200L First Semester", lecturer: "Peter Lasisi" },
      { title: "Pneumatology", stage: "200L First Semester", lecturer: "PST Kolo James" },
      { title: "Prophetic and Deliverance Ministry", stage: "200L First Semester", lecturer: "PST Akinfemi" },
      { title: "Applied Stewardship", stage: "200L First Semester", lecturer: "" },
      { title: "Biblical Management Principles", stage: "200L First Semester", lecturer: "Peter Lasisi" },
      { title: "Principles of Goal Setting and Vision Analysis", stage: "200L First Semester", lecturer: "PST Sam Owoseni" },
      { title: "Balanced Principles of Mentoring", stage: "200L First Semester", lecturer: "PST Femi Johnson" },
      { title: "Biblical Principles of Raising Leaders", stage: "200L First Semester", lecturer: "PST Sunday" },
      { title: "Dynamics of Faith and Mental Exploit", stage: "200L First Semester", lecturer: "PST Sunday" },
      { title: "Dynamics of Prayer and Spiritual Warfare", stage: "200L First Semester", lecturer: "PST Femi Johnson" },
      { title: "Use of English Language", stage: "200L First Semester", lecturer: "PST Sam Owoseni" },
      { title: "Projects", stage: "200L First Semester", allLecturers: true },

      { title: "Index of Excellence in Ministry", stage: "200L Second Semester", lecturer: "PST Momoh" },
      { title: "Principle of Church Growth and Church Planting", stage: "200L Second Semester", lecturer: "PST Momoh" },
      { title: "Soteriology Simplified", stage: "200L Second Semester", lecturer: "SIS Samirah Atukeke" },
      { title: "Biblical Hermeneutics", stage: "200L Second Semester", lecturer: "PST Ubi David" },
      { title: "Practical Leadership Analysis", stage: "200L Second Semester", lecturer: "PST Femi Johnson" },
      { title: "Ministry and Purpose", stage: "200L Second Semester", lecturer: "PST Sunday" },
      { title: "Homiletics Made Handy", stage: "200L Second Semester", lecturer: "Peter Lasisi" },
      { title: "Pneumatology", stage: "200L Second Semester", lecturer: "PST Kolo James" },
      { title: "Prophetic and Deliverance Ministry", stage: "200L Second Semester", lecturer: "PST Akinfemi" },
      { title: "Integrity in Ministry", stage: "200L Second Semester", lecturer: "PST Kolo James" },
      { title: "Biblical Management Principles", stage: "200L Second Semester", lecturer: "Peter Lasisi" },
      { title: "Principles of Goal Setting and Vision Analysis", stage: "200L Second Semester", lecturer: "PST Sam Owoseni" },
      { title: "Balanced Principles of Mentoring", stage: "200L Second Semester", lecturer: "PST Femi Johnson" },
      { title: "Biblical Principles of Raising Leaders", stage: "200L Second Semester", lecturer: "PST Sunday" },
      { title: "Use of English Language", stage: "200L Second Semester", lecturer: "PST Sam Owoseni" },
      { title: "Projects", stage: "200L Second Semester", allLecturers: true }
    ]
  },
  {
    title: "Advanced Diploma Certificate Program in Theology and Leadership",
    level: "Advanced Diploma",
    duration: "One-time programme",
    description: "Advanced Diploma Certificate Program in Theology and Leadership courses.",
    courses: [
      { title: "Old Testament Survey", stage: "Advanced Diploma", lecturer: "PST Momoh" },
      { title: "New Testament Survey", stage: "Advanced Diploma", lecturer: "PST Kolo James" },
      { title: "Synoptic Gospel", stage: "Advanced Diploma", lecturer: "PST Femi Johnson" },
      { title: "Bible History", stage: "Advanced Diploma", lecturer: "PST Ubi David" },
      { title: "Ministry in the Digital Age", stage: "Advanced Diploma", lecturer: "PST Sam Owoseni" },
      { title: "Ecclesiology", stage: "Advanced Diploma", lecturer: "Peter Lasisi" },
      { title: "Advanced Prophetic and Deliverance Ministry", stage: "Advanced Diploma", lecturer: "PST Akinfemi" },
      { title: "Eschatology", stage: "Advanced Diploma", lecturer: "PST Sunday" },
      { title: "Projects", stage: "Advanced Diploma", allLecturers: true }
    ]
  },
  {
    title: "Workers and Leadership Training Program",
    level: "Workers and Leadership",
    duration: "Flexible",
    description: "Workers and Leadership Training Program. No course shells are seeded for this programme.",
    courses: []
  }
];

function courseDescription(programme, course) {
  const assignment = course.allLecturers ? "All Lecturers" : (course.lecturer || "To be assigned");
  return `${course.title} for ${programme.title}. Stage: ${course.stage}. Lecturer: ${assignment}.`;
}

async function createOrUpdateLecturers() {
  const result = new Map();

  for (const name of LECTURERS) {
    const username = slugUsername(name);
    const email = lecturerEmail(username);
    const password = lecturerPassword(name);
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { username },
          { email },
          { name, role: "LECTURER" }
        ]
      }
    });

    if (existing) {
      const updated = await prisma.user.update({
        where: { id: existing.id },
        data: {
          name,
          username,
          role: "LECTURER",
          status: "ACTIVE"
        }
      });
      result.set(name, { ...updated, generatedPassword: password, createdNow: false });
      console.log(`Lecturer ready: ${name} / ${username} / existing account`);
      continue;
    }

    const hashed = await bcrypt.hash(password, 12);
    const created = await prisma.user.create({
      data: {
        name,
        email,
        username,
        password: hashed,
        role: "LECTURER",
        status: "ACTIVE"
      }
    });
    result.set(name, { ...created, generatedPassword: password, createdNow: true });
    console.log(`Lecturer created: ${name} / ${username} / ${password}`);
  }

  return result;
}

async function createOrUpdateProgrammesAndCourses(lecturerMap) {
  let programmeCount = 0;
  let courseCount = 0;
  let accessCount = 0;
  let blankLecturerCount = 0;
  let projectCount = 0;

  for (const programmeData of PROGRAMMES) {
    let programme = await prisma.programme.findFirst({ where: { title: programmeData.title } });

    if (!programme) {
      programme = await prisma.programme.create({
        data: {
          title: programmeData.title,
          level: programmeData.level,
          duration: programmeData.duration,
          description: programmeData.description,
          published: true,
          fee: 0,
          feeUsd: 0,
          currency: "USD",
          paymentPlan: "ONE_TIME"
        }
      });
      console.log(`Programme created: ${programme.title}`);
    } else {
      programme = await prisma.programme.update({
        where: { id: programme.id },
        data: {
          level: programme.level || programmeData.level,
          duration: programme.duration || programmeData.duration,
          description: programme.description || programmeData.description,
          published: true
        }
      });
      console.log(`Programme ready: ${programme.title}`);
    }
    programmeCount += 1;

    for (const courseData of programmeData.courses) {
      let course = await prisma.course.findFirst({
        where: {
          programmeId: programme.id,
          title: courseData.title,
          levelStage: courseData.stage
        }
      });

      const coursePayload = {
        programmeId: programme.id,
        title: courseData.title,
        level: courseData.stage,
        levelStage: courseData.stage,
        duration: "",
        description: courseDescription(programmeData, courseData),
        published: true,
        generalForAllProgrammes: false
      };

      if (!course) {
        course = await prisma.course.create({ data: coursePayload });
        console.log(`Course created: ${programmeData.title} > ${courseData.stage} > ${courseData.title}`);
      } else {
        course = await prisma.course.update({
          where: { id: course.id },
          data: coursePayload
        });
        console.log(`Course ready: ${programmeData.title} > ${courseData.stage} > ${courseData.title}`);
      }
      courseCount += 1;

      let lecturersToAssign = [];
      if (courseData.allLecturers) {
        lecturersToAssign = Array.from(lecturerMap.values());
        projectCount += 1;
      } else if (courseData.lecturer) {
        const normalized = normalizeLecturerName(courseData.lecturer);
        const lecturer = lecturerMap.get(normalized);
        if (lecturer) lecturersToAssign = [lecturer];
      } else {
        blankLecturerCount += 1;
      }

      for (const lecturer of lecturersToAssign) {
        await prisma.courseLecturerAccess.upsert({
          where: {
            courseId_lecturerId: {
              courseId: course.id,
              lecturerId: lecturer.id
            }
          },
          update: { accessLevel: "LECTURER" },
          create: {
            courseId: course.id,
            lecturerId: lecturer.id,
            accessLevel: "LECTURER"
          }
        });
        accessCount += 1;
      }
    }
  }

  return { programmeCount, courseCount, accessCount, blankLecturerCount, projectCount };
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set. Run this on Render backend Shell, or set DATABASE_URL first.");
  }

  console.log("Starting CIBI lecturer/course seed...");
  const lecturerMap = await createOrUpdateLecturers();
  const counts = await createOrUpdateProgrammesAndCourses(lecturerMap);

  console.log("");
  console.log("CIBI seed completed successfully.");
  console.log(`Programmes checked: ${counts.programmeCount}`);
  console.log(`Courses created/updated: ${counts.courseCount}`);
  console.log(`Lecturer assignments created/updated: ${counts.accessCount}`);
  console.log(`Project courses assigned to all lecturers: ${counts.projectCount}`);
  console.log(`Courses left unassigned: ${counts.blankLecturerCount}`);
  console.log("");
  console.log("Lecturer login list:");
  for (const name of LECTURERS) {
    console.log(`${name} | ${slugUsername(name)} | ${lecturerPassword(name)}`);
  }
}

main()
  .catch((error) => {
    console.error("CIBI seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
