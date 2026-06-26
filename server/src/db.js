import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

export const prisma = new PrismaClient();

const defaultSettings = [
  ["student_whatsapp_group_link", "https://chat.whatsapp.com/PUT-YOUR-STUDENT-GROUP-LINK-HERE"],
  ["bank_name", process.env.CROBIC_BANK_NAME || "PUT BANK NAME HERE"],
  ["account_name", process.env.CROBIC_ACCOUNT_NAME || "Champions Royal Bible College"],
  ["account_number", process.env.CROBIC_ACCOUNT_NUMBER || "0000000000"],
  ["base_currency", "USD"],
  ["currency_rates", "NGN|1500\nGHS|12\nKES|130\nZAR|18\nEUR|0.92\nGBP|0.78"],
  ["currency_converter_note", "Rates are approximate and can be updated by Super Admin."],

  ["home_card_1_title", "Programs Available"],
  ["home_card_1_text", "Certificate, Diploma, Degree and executive learning options."],
  ["home_card_2_title", "Learning Options"],
  ["home_card_2_text", "Regular classes and executive classes for working ministers."],
  ["home_card_3_title", "Structured Admission"],
  ["home_card_3_text", "Portal access begins after registration, payment confirmation and admission approval."],
  ["home_stat_1_value", "1000+"],
  ["home_stat_1_label", "Ministerial Graduates"],
  ["home_stat_2_value", "15+"],
  ["home_stat_2_label", "Years of Excellence"],
  ["home_stat_3_value", "6"],
  ["home_stat_3_label", "Ministry Tracks"],
  ["home_stat_4_value", "Global"],
  ["home_stat_4_label", "Reach and Impact"],
  ["home_about_kicker", "About Us"],
  ["home_about_title", "About CROBIC"],
  ["home_about_paragraph_1", "Champions Royal Bible College is the biblical training arm of Champions Royal Assembly, raising ministers and kingdom leaders through biblical doctrine, spiritual formation and practical ministry preparation."],
  ["home_about_paragraph_2", "CROBIC combines theological learning, live classes, recorded lessons, book resources and a protected student portal for a clean academic experience."],
  ["home_about_image_url", "/crobic-images/convocation-handshake.jpg"],
  ["home_about_caption_name", "Papa Joshua Iginla"],
  ["home_about_caption_title", "Founder and President"],
  ["home_programs_eyebrow", "Academics"],
  ["home_programs_title", "Our Programs"],
  ["home_programs_text", "Certificate, Diploma and Degree routes for ministers and Bible students."],
  ["home_paths_eyebrow", "Learning Paths"],
  ["home_paths_title", "Choose Your Learning Path"],
  ["home_paths_text", "Flexible options to fit your calling and schedule."],
  ["home_regular_class_title", "Regular Classes"],
  ["home_regular_class_text", "Full-time immersive biblical training for students seeking complete ministerial preparation."],
  ["home_regular_class_points", "New ministers and full-time students|Deep theological foundation|Complete ministry preparation"],
  ["home_executive_class_title", "Executive Classes"],
  ["home_executive_class_text", "Part-time training designed for pastors and leaders who cannot attend regular weekday classes."],
  ["home_executive_class_points", "Active pastors and evangelists|Working-class ministers|Flexible learning schedule"],
  ["home_graduate_kicker", "Our Graduates"],
  ["home_graduate_title", "Graduates We Have Raised"],
  ["home_graduate_quote", "“CROBIC continues to raise champions for God’s kingdom through biblical training, discipline and spiritual formation.”"],
  ["home_graduate_author", "Prophet Joshua Iginla"],
  ["home_graduate_number", "1000+"],
  ["home_graduate_number_label", "Ministerial Graduates"],
  ["home_graduate_image_url", "/crobic-images/graduation-stage.jpg"],
  ["home_books_eyebrow", "Book Library"],
  ["home_books_title", "Books available to the public"],
  ["home_books_text", "Visitors can buy books directly through the official Stellar purchase links."],
  ["home_cta_kicker", "Admission Open"],
  ["home_cta_title", "Ready to Become a Champion for Christ?"],
  ["home_cta_text", "Admission is open for pastors, evangelists, prophets, Bible teachers, associate ministers, leaders, academics and professionals."],
  ["home_cta_primary_button", "Apply Now"],
  ["home_cta_secondary_button", "View Programs"],

  ["about_hero_eyebrow", "About Us"],
  ["about_hero_title", "About Champions Royal Bible College"],
  ["about_hero_text", "The biblical training platform of Champions Royal Assembly, built for ministers, pastors and kingdom leaders."],
  ["about_hero_image_url", "/crobic-images/convocation-handshake.jpg"],
  ["about_section_kicker", "Who We Are"],
  ["about_section_title", "Raising a Generation of Champions"],
  ["about_section_paragraph_1", "CROBIC is structured to train students in biblical doctrine, spiritual growth, leadership, practical ministry and kingdom service."],
  ["about_section_paragraph_2", "The platform combines a public website, admission process, payment flow, protected student portal, live classes, recorded lessons and a book library."],
  ["about_section_image_url", "/crobic-images/classroom.jpg"],
  ["about_mission_title", "Mission"],
  ["about_mission_text", "To provide sound biblical teaching, ministry training and spiritual development through a structured, accessible and world-class learning platform."],
  ["about_vision_title", "Vision"],
  ["about_vision_text", "To raise equipped leaders who understand scripture, walk in wisdom and serve effectively in ministry and society."],

  ["programs_hero_eyebrow", "Academics"],
  ["programs_hero_title", "CROBIC Programs"],
  ["programs_hero_text", "Certificate, Diploma and Degree routes for students preparing for ministry and leadership."],
  ["programs_hero_image_url", "/crobic-images/classroom.jpg"],
  ["programs_classes_eyebrow", "Class Options"],
  ["programs_classes_title", "Regular and Executive Classes"],
  ["programs_classes_text", "CROBIC is designed to serve both full-time learners and working ministers."],
  ["programs_regular_title", "Regular Classes"],
  ["programs_regular_text", "For students who want a fuller classroom learning experience."],
  ["programs_regular_points", "Daytime learning|Structured training|Ministry preparation"],
  ["programs_executive_title", "Executive Classes"],
  ["programs_executive_text", "For pastors, ministers and professionals with active schedules."],
  ["programs_executive_points", "Flexible timing|Working ministers|Practical theological growth"],

  ["books_hero_eyebrow", "Book Library"],
  ["books_hero_title", "Books by Joshua Iginla"],
  ["books_hero_text", "Open to the general public. Each book uses its official Stellar purchase link."],
  ["books_hero_image_url", "/crobic-images/graduation-stage.jpg"],
  ["gallery_hero_eyebrow", "Gallery"],
  ["gallery_hero_title", "CROBIC Gallery"],
  ["gallery_hero_text", "A visual glimpse into CROBIC training, classroom moments and graduation ceremonies."],
  ["gallery_hero_image_url", "/crobic-images/graduation-stage.jpg"],
  ["contact_hero_eyebrow", "Contact"],
  ["contact_hero_title", "Get in Touch with CROBIC"],
  ["contact_hero_text", "Contact the college for admissions, book enquiries, student support and general information."],
  ["contact_hero_image_url", "/crobic-images/classroom.jpg"],
  ["contact_phone_title", "Phone"],
  ["contact_phone", "+234 814 943 9447"],
  ["contact_location_title", "Location"],
  ["contact_address", "Kubwa, Abuja, FCT, Nigeria"],
  ["contact_enquiry_title", "Enquiries"],
  ["contact_enquiry_text", "Admissions, book support and general CROBIC information."],
  ["contact_email", "info@crobic.org"],
  ["office_hours", "Monday to Saturday, 9 AM to 5 PM"],

  ["admission_hero_eyebrow", "Admission and Enrollment"],
  ["admission_hero_title", "Admission is Now Open"],
  ["admission_hero_text", "Apply for CROBIC programmes, complete registration payment, and receive portal access after payment confirmation and admin approval."],
  ["admission_hero_image_url", "/crobic-images/classroom.jpg"],
  ["admission_eligibility_eyebrow", "Eligibility"],
  ["admission_eligibility_title", "Who Should Apply"],
  ["admission_eligibility_text", "CROBIC is open to ministers, Bible students, church workers and kingdom leaders seeking structured theological training."],
  ["admission_roles", "Pastors|G.O. and resident pastors\nEvangelists|Field and outreach ministers\nProphets|Prophetic ministry leaders\nBible Teachers|Sunday school and Bible study\nAssociate Ministers|Ministry workers and leaders\nChurch Workers|Deacons, workers and volunteers"],
  ["admission_requirements_eyebrow", "Prerequisites"],
  ["admission_requirements_title", "Admission Requirements"],
  ["admission_requirements_text", "Applicants should be ready for biblical learning, ministry discipline and structured academic participation."],
  ["admission_basic_requirements", "Believer of good standing with a local church\nConscious call of God for Christian service\nPastor or ministry recommendation where applicable\nSecondary school completion or equivalent foundation\nAbility to study and communicate in English\nWillingness to complete all classes, assignments and ministry training"],
  ["admission_additional_requirements", "Ministry involvement or church service experience\nShort statement of conversion and call to ministry\nInterview or review by the admissions team when required\nPayment confirmation before student portal activation\nAdmin approval before access to courses, live classes and student WhatsApp group\nAgreement to CROBIC academic and spiritual discipline standards"],
  ["admission_apply_eyebrow", "Apply Online"],
  ["admission_apply_title", "Enroll Online Now"],
  ["admission_apply_text", "Start your application, choose your programme and complete your registration payment."],
  ["admission_start_title", "Create Your Student Account"],
  ["admission_start_text", "Students do not get automatic access after registration. Portal access opens only after payment confirmation and admin approval."],
  ["admission_start_box_title", "Start Application"],
  ["admission_start_box_text", "Create your student account first. After registration, you will be directed to complete payment."],
  ["admission_student_payment_title", "Complete Your Payment"],
  ["admission_process_eyebrow", "How It Works"],
  ["admission_process_title", "Application Process"],
  ["admission_process_text", "A clear admission path from registration to active student portal access."],
  ["admission_application_steps", "Create Account|Begin your student application with your basic information.\nChoose Programme|Select Certificate, Diploma, Degree or Executive learning stream.\nComplete Payment|Pay through Paystack or submit bank transfer details for review.\nPayment Review|The admissions team confirms payment and application details.\nAdmin Approval|Approved students receive active portal access.\nBegin Studies|Access courses, lessons, live classes and student announcements."],
  ["admission_fees_eyebrow", "Fees"],
  ["admission_fees_title", "Programme Fees"],
  ["admission_fees_text", "Fees are shown based on active programmes created by admin."],
  ["admission_calendar_eyebrow", "Calendar"],
  ["admission_calendar_title", "Academic Calendar 2026"],
  ["admission_calendar_text", "Key admission and academic dates for the incoming session."],
  ["admission_calendar", "Application Opens|January 2026\nScreening and Review|March 2026\nClasses Begin|April 2026\nFirst Term Ends|July 2026"],
  ["admission_contact_eyebrow", "Get in Touch"],
  ["admission_contact_title", "Contact Admissions Office"],
  ["admission_contact_text", "For help with application, payment confirmation or programme selection."],
  ["admission_contact_location", "Champions Royal Assembly, Kubwa, Abuja"],
  ["admission_contact_phone_title", "Phone"],
  ["admission_contact_location_title", "Location"],
  ["admission_contact_hours_title", "Office Hours"],

  ["footer_brand_title", "CROBIC"],
  ["footer_brand_text", "Champions Royal Bible College"],
  ["footer_brand_small", "Raising a Generation of Champions"],
  ["footer_address", "Kubwa, Abuja, FCT, Nigeria"],
  ["footer_phone", "+234 814 943 9447"],
  ["footer_email", "info@crobic.org"],
  ["footer_copyright", "© 2026 Champions Royal Bible College (CROBIC). All Rights Reserved."],
  ["footer_bottom_note", "The Biblical Arm of Champions Royal Assembly International"]
];

export async function seedDatabase() {
  const adminEmail = process.env.ADMIN_EMAIL || "admin@crobic.org";
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
  const adminName = process.env.ADMIN_NAME || "CROBIC Admin";

  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existingAdmin) {
    const password = await bcrypt.hash(adminPassword, 10);
    await prisma.user.create({
      data: {
        name: adminName,
        email: adminEmail,
        password,
        role: "SUPER_ADMIN",
        status: "ACTIVE"
      }
    });
  } else if (existingAdmin.role === "ADMIN" && existingAdmin.email === adminEmail) {
    await prisma.user.update({ where: { id: existingAdmin.id }, data: { role: "SUPER_ADMIN", status: "ACTIVE" } });
  }

  const bookCount = await prisma.book.count();
  if (bookCount === 0) {
    await prisma.book.createMany({
      data: [
        {
          title: "The Spirit of Excellence",
          author: "Joshua Iginla",
          category: "Leadership",
          price: "$8.50",
          buyLink: "https://your-stellar-link.com/book-1",
          imageUrl: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?q=80&w=600&auto=format&fit=crop",
          description: "A transformational book on discipline, purpose and excellence."
        },
        {
          title: "Power for Destiny Fulfilment",
          author: "Joshua Iginla",
          category: "Destiny",
          price: "$7.00",
          buyLink: "https://your-stellar-link.com/book-2",
          imageUrl: "https://images.unsplash.com/photo-1519682337058-a94d519337bc?q=80&w=600&auto=format&fit=crop",
          description: "Discover the spiritual keys for walking in divine purpose."
        }
      ]
    });
  }

  const courseCount = await prisma.course.count();
  if (courseCount === 0) {
    const course = await prisma.course.create({
      data: {
        title: "Foundation of Christian Doctrine",
        level: "Beginner",
        duration: "12 Months",
        fee: 75000,
        feeUsd: 50,
        currency: "USD",
        imageUrl: "https://images.unsplash.com/photo-1504052434569-70ad5836ab65?q=80&w=900&auto=format&fit=crop",
        description: "Learn the core doctrines of the Christian faith with structure and clarity."
      }
    });

    const moduleOne = await prisma.courseModule.create({
      data: {
        courseId: course.id,
        title: "Stage 1: Foundations",
        description: "Start here. These lessons establish the foundation before the next stage opens.",
        moduleOrder: 1
      }
    });

    await prisma.lesson.createMany({
      data: [
        {
          courseId: course.id,
          moduleId: moduleOne.id,
          title: "Introduction to Christian Doctrine",
          videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
          notesUrl: "https://example.com/lesson-note.pdf",
          duration: "18 mins",
          lessonOrder: 1,
          required: true,
          completionPercentRequired: 90
        },
        {
          courseId: course.id,
          moduleId: moduleOne.id,
          title: "The Authority of Scripture",
          videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
          notesUrl: "https://example.com/lesson-note.pdf",
          duration: "22 mins",
          lessonOrder: 2,
          required: true,
          completionPercentRequired: 90
        }
      ]
    });
  }

  const slideCount = await prisma.slide.count();
  if (slideCount === 0) {
    await prisma.slide.createMany({
      data: [
        {
          eyebrow: "Champions Royal Bible College",
          title: "A Premium Bible College for Kingdom Leaders",
          description: "Study structured biblical courses, attend live sessions, watch lessons and grow through a world-class Christian learning platform.",
          imageUrl: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=1200&auto=format&fit=crop",
          ctaText: "Apply Now",
          ctaPage: "admissions",
          slideOrder: 1
        },
        {
          eyebrow: "Learn Anywhere",
          title: "Courses, Lessons and Live Classes in One Portal",
          description: "Students can watch pre-recorded lessons, join live classes, download notes and track their learning progress.",
          imageUrl: "https://images.unsplash.com/photo-1523580846011-d3a5bc25702b?q=80&w=1200&auto=format&fit=crop",
          ctaText: "View Programs",
          ctaPage: "programs",
          slideOrder: 2
        }
      ]
    });
  }

  const galleryCount = await prisma.gallery.count();
  if (galleryCount === 0) {
    await prisma.gallery.createMany({
      data: [
        { title: "Graduation Ceremony", category: "Graduation", imageUrl: "/crobic-images/graduation-stage.jpg", description: "CROBIC graduation ceremony" },
        { title: "Certificate Presentation", category: "Convocation", imageUrl: "/crobic-images/convocation-handshake.jpg", description: "Certificate presentation" },
        { title: "Classroom Training", category: "Training", imageUrl: "/crobic-images/classroom.jpg", description: "Classroom training session" }
      ]
    });
  }

  for (const [key, value] of defaultSettings) {
    await prisma.setting.upsert({
      where: { key },
      update: {},
      create: { key, value }
    });
  }
}
