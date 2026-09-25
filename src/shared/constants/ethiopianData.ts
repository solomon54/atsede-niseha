//src/shared/constants/ethiopianData.ts
export const ETHIOPIAN_GEOGRAPHY: Record<string, string[]> = {
  "አዲስ አበባ ከተማ አስተዳደር": [
    "አዲስ ከተማ",
    "አራዳ",
    "አቃቂ ቃሊቲ",
    "ቦሌ",
    "ጉለሌ",
    "ቂርቆስ",
    "ኮልፌ ቀራኒዮ",
    "ልደታ",
    "ንፋስ ስልክ ላፍቶ",
    "የካ",
    "ለሚ ኩራ",
  ],
  "አማራ ክልል": [
    "ሰሜን ጎንደር",
    "ደቡብ ጎንደር",
    "ምዕራብ ጎንደር",
    "ማዕከላዊ ጎንደር",
    "ሰሜን ወሎ",
    "ደቡብ ወሎ",
    "ሰሜን ሸዋ",
    "ምስራቅ ጎጃም",
    "ምዕራብ ጎጃም",
    "ዋግ ኽምራ",
    "አዊ",
    "ኦሮሚያ ልዩ ዞን",
    "ባሕር ዳር",
  ],
  "ኦሮሚያ ክልል": [
    "ሰሜን ሸዋ",
    "ምዕራብ ሸዋ",
    "ደቡብ ምዕራብ ሸዋ",
    "ምስራቅ ሸዋ",
    "አርሲ",
    "ምዕራብ አርሲ",
    "ባሌ",
    "ምስራቅ ባሌ",
    "ቦረና",
    "ጉጂ",
    "ምዕራብ ጉጂ",
    "ምስራቅ ሐረርጌ",
    "ምዕራብ ሐረርጌ",
    "ሆሮ ጉድሩ ወለጋ",
    "ምስራቅ ወለጋ",
    "ምዕራብ ወለጋ",
    "ቄለም ወለጋ",
    "ኢሉባቦር",
    "ቡኖ በደሌ",
    "ጅማ",
    "ፊንፊኔ ዙሪያ ልዩ ዞን",
  ],
  "ትግራይ ክልል": ["ሰሜን ምዕራብ", "ማዕከላዊ", "ምስራቃዊ", "ደቡብ ምስራቅ", "ደቡብ", "ምዕራባዊ", "መቐለ"],
  "የደቡብ ኢትዮጵያ ክልል": [
    "ወላይታ",
    "ጋሞ",
    "ጎፋ",
    "ጌዴኦ",
    "ደቡብ ኦሞ",
    "ደቡብ አሪ",
    "ኮንሶ",
    "ቡርጂ",
    "አማሮ",
    "አሌ",
    "ድራሼ",
    "ባስኬቶ",
  ],
  "የማዕከላዊ ኢትዮጵያ ክልል": [
    "ጉራጌ",
    "ስልጤ",
    "ሀዲያ",
    "ከምባታ ጤምባሮ",
    "ሀላባ",
    "የም",
    "ምስራቅ ጉራጌ",
    "ቄቤና",
    "ማረቆ",
  ],
  "የደቡብ ምዕራብ ኢትዮጵያ ሕዝቦች ክልል": ["ካፋ", "ሸካ", "ቤንች ሸኮ", "ዳውሮ", "ምዕራብ ኦሞ", "ኮንታ"],
  "ሶማሌ ክልል": [
    "ሲቲ",
    "ፋፈን",
    "ጃረር",
    "ኤረር",
    "ኖጎብ",
    "ቆራሄ",
    "ሸበሌ",
    "አፍዴር",
    "ሊበን",
    "ዳዋ",
    "ዶሎ",
  ],
  "አፋር ክልል": ["አውሲ ረሱ", "ኪልበቲ ረሱ", "ገቢ ረሱ", "ፋንቲ ረሱ", "ሀሪ ረሱ"],
  "ቤኒሻንጉል ጉሙዝ ክልል": ["መተከል", "አሶሳ", "ካማሺ", "ማኦ ኮሞ", "ባምባሲ"],
  "ጋምቤላ ሕዝቦች ክልል": ["አኝዋክ", "ኑዌር", "መዠንግር", "ኢታንግ"],
  "ሲዳማ ክልል": ["ሲዳማ"],
  "ሐረሪ ሕዝብ ክልል": ["ሐረሪ"],
  "ድሬዳዋ ከተማ አስተዳደር": ["ድሬዳዋ"],
};

//Ethiopian languages, including the top 10 most widely used/significant languages and an extended list of other languages spoken in Ethiopia. The top 10 languages are listed first, followed by the extended list in alphabetical order.
export const ETHIOPIAN_LANGUAGES: string[] = [
  // Priority Group (10 Most Widely Used/Significant)
  "ግዕዝ",
  " አማርኛ (Amharic)",
  "Afaan Oromoo (አፋን ኦሮሞ)",
  "ትግርኛ (Tigrinya)",
  "Somali (ሶማሊኛ)",
  "Sidama (ሲዳሙ)",
  "Wolaytta (ወላይታቱ)",
  "Gurage (ጉራጊኛ)",
  "Afar (አፋር)",
  "English",

  // Extended Group (Alphabetical Order)
  "Aari (አሪ)",
  "Agaw-Awi (አገው-አዊ)",
  "Agaw-Kamyr (አገው-ከምር)",
  "Alaba (አላባ)",
  "Arbore (አርቦሬ)",
  "Argobba (አርጎባ)",
  "Bacha (ባቻ)",
  "Basketo (ባስኬቶ)",
  "Bench (ቤንች)",
  "Berta (በርታ)",
  "Bodi (ቦዲ)",
  "Brayle (ብራይሌ)",
  "Burji (ቡርጂ)",
  "Chara (ቻራ)",
  "Daasanech (ዳሰነች)",
  "Dawro (ዳውሮ)",
  "Dirasha (ድራሻ)",
  "Dizi (ዲዚ)",
  "Dongotono (ዶንጎቶኖ)",
  "Fedashe (ፈዳሼ)",
  "Gamo (ጋሞ)",
  "Ganjule (ጋንጁሌ)",
  "Gawwada (ገውዳ)",
  "Gedeo (ጌዴኦ)",
  "Gidole (ጊዶሌ)",
  "Goffa (ጎፋ)",
  "Gumuz (ጉሙዝ)",
  "Hadiya (ሀዲያ)",
  "Hamar (ሐመር)",
  "Harari (ሐረሪ)",
  "Irob (ኢሮብ)",
  "Kachama (ካቻማ)",
  "Kambaata (ከምባታ)",
  "Karo (ካሮ)",
  "Kefficho (ከፊቾ)",
  "Koorete (ኮሬቴ)",
  "Konso (ኮንሶ)",
  "Konta (ኮንታ)",
  "Kunama (ኩናማ)",
  "Kwama (ቋማ)",
  "Kwegu (ክዌጉ)",
  "Libido (ሊቢዶ)",
  "Maale (ማሌ)",
  "Majang (መዠንግር)",
  "Mao (ማኦ)",
  "Me'en (መኤን)",
  "Melo (ሜሎ)",
  "Mossiya (ሞሲያ)",
  "Murle (ሙርሌ)",
  "Mursi (ሙርሲ)",
  "Nao (ናኦ)",
  "Nara (ናራ)",
  "Nyangatom (ኛንጋቶም)",
  "Opo (ኦፖ)",
  "Oyda (ኦይዳ)",
  "Qebena (ቄቤና)",
  "Saho (ሳሆ)",
  "Sebat Bet Gurage (ሰባት ቤት ጉራጌ)",
  "Shabo (ሻቦ)",
  "Shekkacho (ሸካቾ)",
  "Sheko (ሸኮ)",
  "Shinasha (ሺናሻ)",
  "Shita (ሺታ)",
  "Silt'e (ስልጤ)",
  "Surma (ሱርማ)",
  "Tembaro (ጤምባሮ)",
  "Tsamai (ጸማይ)",
  "Welene (ወለኔ)",
  "Werji (ወርጂ)",
  "Xamtanga (ኽምታንጋ)",
  "Yem (የም)",
  "Zay (ዛይ)",
  "Zayse (ዘይሴ)",
];

// List of top universities in Ethiopia
export const TOP_UNIVERSITIES = [
  {
    id: "AAU",
    name: "አዲስ አበባ ዩኒቨርሲቲ",
    englishName: "Addis Ababa University",
    isTop: true,
  },
  {
    id: "JIMMA",
    name: "ጅማ ዩኒቨርሲቲ",
    englishName: "Jimma University",
    isTop: true,
  },
  {
    id: "BAHIR_DAR",
    name: "ባሕር ዳር ዩኒቨርሲቲ",
    englishName: "Bahir Dar University",
    isTop: true,
  },
  {
    id: "GONDAR",
    name: "ጎንደር ዩኒቨርሲቲ",
    englishName: "University of Gondar",
    isTop: true,
  },
  {
    id: "HAWASSA",
    name: "ሐዋሳ ዩኒቨርሲቲ",
    englishName: "Hawassa University",
    isTop: true,
  },
  {
    id: "HARAMAYA",
    name: "ሐረማያ ዩኒቨርሲቲ",
    englishName: "Haramaya University",
    isTop: true,
  },
  {
    id: "ARBA_MINCH",
    name: "አርባ ምንጭ ዩኒቨርሲቲ",
    englishName: "Arba Minch University",
    isTop: true,
  },
  {
    id: "MEKELLE",
    name: "መቐለ ዩኒቨርሲቲ",
    englishName: "Mekelle University",
    isTop: true,
  },
  {
    id: "AASTU",
    name: "አዲስ አበባ ሳይንስና ቴክኖሎጂ ዩኒቨርሲቲ",
    englishName: "Addis Ababa Science and Technology University",
    isTop: true,
  },
  {
    id: "ASTU",
    name: "አዳማ ሳይንስና ቴክኖሎጂ ዩኒቨርሲቲ",
    englishName: "Adama Science and Technology University",
    isTop: true,
  },
  {
    id: "AMBO",
    name: "አምቦ ዩኒቨርሲቲ",
    englishName: "Ambo University",
    isTop: false,
  },
  {
    id: "DEBRE_BERHAN",
    name: "ደብረ ብርሃን ዩኒቨርሲቲ",
    englishName: "Debre Berhan University",
    isTop: false,
  },
  {
    id: "DEBRE_MARKOS",
    name: "ደብረ ማርቆስ ዩኒቨርሲቲ",
    englishName: "Debre Markos University",
    isTop: false,
  },
  {
    id: "DIRE_DAWA",
    name: "ድሬዳዋ ዩኒቨርሲቲ",
    englishName: "Dire Dawa University",
    isTop: false,
  },
  {
    id: "WOLLO",
    name: "ወሎ ዩኒቨርሲቲ",
    englishName: "Wollo University",
    isTop: false,
  },
  {
    id: "ADIGRAT",
    name: "ዓዲግራት ዩኒቨርሲቲ",
    englishName: "Adigrat University",
    isTop: false,
  },
  {
    id: "AKSUM",
    name: "አክሱም ዩኒቨርሲቲ",
    englishName: "Aksum University",
    isTop: false,
  },
  {
    id: "SAMARA",
    name: "ሰመራ ዩኒቨርሲቲ",
    englishName: "Samara University",
    isTop: false,
  },
  {
    id: "JIGJIGA",
    name: "ጅጅጋ ዩኒቨርሲቲ",
    englishName: "Jigjiga University",
    isTop: false,
  },
  {
    id: "WOLAITA_SODO",
    name: "ወላይታ ሶዶ ዩኒቨርሲቲ",
    englishName: "Wolaita Sodo University",
    isTop: false,
  },
  {
    id: "DILLA",
    name: "ዲላ ዩኒቨርሲቲ",
    englishName: "Dilla University",
    isTop: false,
  },
  {
    id: "WOLLEGA",
    name: "ወለጋ ዩኒቨርሲቲ",
    englishName: "Wollega University",
    isTop: false,
  },
  {
    id: "MADDA_WALABU",
    name: "መዳ ወላቡ ዩኒቨርሲቲ",
    englishName: "Madda Walabu University",
    isTop: false,
  },
  {
    id: "ASSOSA",
    name: "አሶሳ ዩኒቨርሲቲ",
    englishName: "Assosa University",
    isTop: false,
  },
  {
    id: "GAMBELLA",
    name: "ጋምቤላ ዩኒቨርሲቲ",
    englishName: "Gambella University",
    isTop: false,
  },
  {
    id: "METU",
    name: "መቱ ዩኒቨርሲቲ",
    englishName: "Mettu University",
    isTop: false,
  },
  {
    id: "WOLDIA",
    name: "ወልድያ ዩኒቨርሲቲ",
    englishName: "Woldia University",
    isTop: false,
  },
  {
    id: "DEBRE_TABOR",
    name: "ደብረ ታቦር ዩኒቨርሲቲ",
    englishName: "Debre Tabor University",
    isTop: false,
  },
  {
    id: "ARSI",
    name: "አርሲ ዩኒቨርሲቲ",
    englishName: "Arsi University",
    isTop: false,
  },
  {
    id: "BULE_HORA",
    name: "ቡሌ ሆራ ዩኒቨርሲቲ",
    englishName: "Bule Hora University",
    isTop: false,
  },
  {
    id: "WACHAMO",
    name: "ዋቻሞ ዩኒቨርሲቲ",
    englishName: "Wachamo University",
    isTop: true,
  },
  {
    id: "WELKITE",
    name: "ወልቂጤ ዩኒቨርሲቲ",
    englishName: "Welkite University",
    isTop: false,
  },
  {
    id: "MIZAN_TEPI",
    name: "ሚዛን ቴፒ ዩኒቨርሲቲ",
    englishName: "Mizan-Tepi University",
    isTop: false,
  },
  {
    id: "INJIBARA",
    name: "እንጅባራ ዩኒቨርሲቲ",
    englishName: "Injibara University",
    isTop: false,
  },
  {
    id: "DEBARK",
    name: "ደባርቅ ዩኒቨርሲቲ",
    englishName: "Debark University",
    isTop: false,
  },
  {
    id: "MEKDELA_AMBA",
    name: "መቅደላ አምባ ዩኒቨርሲቲ",
    englishName: "Mekdela Amba University",
    isTop: false,
  },
  {
    id: "RAYA",
    name: "ራያ ዩኒቨርሲቲ",
    englishName: "Raya University",
    isTop: false,
  },
  {
    id: "JINKA",
    name: "ጂንካ ዩኒቨርሲቲ",
    englishName: "Jinka University",
    isTop: false,
  },
  {
    id: "DEMBI_DOLO",
    name: "ደምቢ ዶሎ ዩኒቨርሲቲ",
    englishName: "Dembi Dolo University",
    isTop: false,
  },
  {
    id: "KEBRI_DEHAR",
    name: "ቀብሪደሃር ዩኒቨርሲቲ",
    englishName: "Kebri Dehar University",
    isTop: false,
  },
  {
    id: "WERABE",
    name: "ወራቤ ዩኒቨርሲቲ",
    englishName: "Werabe University",
    isTop: false,
  },
  {
    id: "SELALE",
    name: "ሰላሌ ዩኒቨርሲቲ",
    englishName: "Selale University",
    isTop: false,
  },
  {
    id: "ODA_BULTUM",
    name: "ኦዳ ቡልቱም ዩኒቨርሲቲ",
    englishName: "Oda Bultum University",
    isTop: false,
  },
  {
    id: "BONGA",
    name: "ቦንጋ ዩኒቨርሲቲ",
    englishName: "Bonga University",
    isTop: false,
  },
  {
    id: "KOTEBE",
    name: "ኮተቤ የትምህርት ዩኒቨርሲቲ",
    englishName: "Kotebe University of Education",
    isTop: false,
  },
  {
    id: "ST_MARYS",
    name: "ቅድስት ማሪያም ዩኒቨርሲቲ",
    englishName: "St. Mary's University",
    isTop: true,
  },
  {
    id: "UNITY",
    name: "ዩኒቲ ዩኒቨርሲቲ",
    englishName: "Unity University",
    isTop: true,
  },
  {
    id: "RIFT_VALLEY",
    name: "ሪፍት ቫሊ ዩኒቨርሲቲ",
    englishName: "Rift Valley University",
    isTop: true,
  },
  {
    id: "ADMAS",
    name: "አድማስ ዩኒቨርሲቲ",
    englishName: "Admas University",
    isTop: false,
  },
  {
    id: "ALPHA",
    name: "አልፋ ዩኒቨርሲቲ",
    englishName: "Alpha University",
    isTop: false,
  },
];

// Accademic structure of Ethiopian universities
export type AcademicMap = Record<string, Record<string, string[]>>;
export const UNIVERSITY_MASTER_MAP: AcademicMap = {
    "ዋቸሞ ዩኒቨርሲቲ (Wachemo University - WCU)": {
    "ኢንጂነሪንግና ቴክኖሎጂ ኮሌጅ (College of Engineering & Technology)": [
      "BSc in Architecture",
      "BSc in Chemical Engineering",
      "BSc in Civil Engineering",
      "BSc in Computer Science",
      "BSc in Construction Technology and Management",
      "BSc in Electrical and Computer Engineering",
      "BSc in Electro-Mechanical Engineering",
      "BSc in Surveying Engineering",
      "BSc in Information System (IS)",
      "BSc in Information Technology (IT)",
      "BSc in Mechanical Engineering",
      "BSc in Software Engineering",
      "BSc in Hydraulic and Water Resource Engineering",
      "BSc in Biomedical Engineering",
      "MSc in Electrical Power Engineering",
      "MSc in Electrical and Communication Engineering",
      "MSc in Computer Science",
      "MSc in Process Engineering",
      "MSc in Geo-informatics",
      "MSc in Geo-informatics Engineering",
      "MSc in Computer Engineering",
      "MSC in Thermal Engineering",
      "MSC in Structural Engineering",
      "MSc in Water Supply & Sanitary Engineering",
      "MSc in Information Technology (IT)",
      "MSc in Construction Technology & Management",
      "MSc in Road & Transport Engineering"
    ],
    "ተፈጥሮና ቀመር ሳይንስ ኮሌጅ (College of Natural and Computational Science)": [
      "BSc in Biology",
      "BSc in Chemistry",
      "BSc in Mathematics",
      "BSc in Statistics",
      "BSc in Biotechnology",
      "BSc in Geology",
      "BSc in Sport Science",
      "BSc in Industrial Chemistry",
      "MSc in Applied Statistics",
      "MSc in Organic Chemistry",
      "MSc in Football Coaching",
      "MSc in Valley Ball Coaching",
      "MSc in Sport Management",
      "MSc in Biostatistics",
      "MSc in Quantum Optics",
      "MSc in Condensed Matter",
      "MSc in Biotechnology",
      "MSc in Botanical Science",
      "MSc in Applied Microbiology",
      "MEd in Mathematical Education",
      "MSc in Exercises Physiology",
      "MSc in Analysis (Mathematics)",
      "MSc in Animal Biotechnology",
      "MSc in Physics (Condensed matter)"
    ],
    "ሕክምናና ጤና ሳይንስ ኮሌጅ (College of Medicine and Health Science)": [
      "BSc in Anesthesia",
      "BSc in Medicine",
      "BSc in Midwifery",
      "BSc in Comprehensive Nursing",
      "BSc in Public Health",
      "BSc in Health Informatics",
      "BSc in Medical Laboratory Technology",
      "BSc in Pharmacy",
      "BSc in Surgical Nursing (PB)",
      "BSc in Paediatrics & Child Health Nursing (PB)",
      "BSc in Dental Medicine",
      "MPH in General Public Health",
      "MPH in Health Education and Promotion",
      "MPH in Epidemiology",
      "MPH in Reproductive Health",
      "MPH in Clinical Pharmacy",
      "Specialty in Gynecology",
      "Specialty in General Surgery",
      "Specialty in Pediatrics and Child Health",
      "Specialty in Internal Medicine",
      "Specialty in Orthopedics and Trauma Surgery"
    ],
    "ግብርና ሳይንስ ኮሌጅ (College of Agricultural Sciences)": [
      "BSc in Animal Science",
      "BSc in Horticulture",
      "BSc in Natural Resource Management",
      "BSc in Plant Science",
      "BSc in Environmental Science",
      "BSc in Food Science and Postharvest Technology",
      "BSc in Agro Economics",
      "BSc in Rural Development & Agricultural Extension",
      "MSc in Animal Production",
      "MSc in Animal breeding & Genetics",
      "MSc in Agroforestry",
      "MSc in Agronomy",
      "MSc in Agricultural Economics",
      "MSc in Environmental Science",
      "MSc in Rural Development and Agricultural Extension",
      "MSc in Soil Science",
      "MSc in Plant Breeding",
      "MSc in Livelihood and Food Security",
      "MSc in Integrated Watershed Management",
      "PhD in Soil Science"
    ],
    "ቢዝነስና ኢኮኖሚክስ ኮሌጅ (College of Business and Economics)": [
      "BA in Accounting and Finance",
      "BA in Management",
      "BA in Economics",
      "BA in Marketing Management",
      "BA in Public Administration and Development Management",
      "BA in Tourism & Hotel Management",
      "MA in Accounting and Finance",
      "MA in Development Economics",
      "Masters of Business Administration (MBA)",
      "MA in Development Management"
    ],
    "ማኅበራዊ ሳይንስና ሂዩማኒቲስ ኮሌጅ (College of Social Science and Humanities)": [
      "BA in Political Science and International Relation",
      "BA in English Language and Literature",
      "BA in Geography and Environmental Studies",
      "BA in Hadiyissa Language & Literature",
      "BA in Sociology",
      "BA in History & Heritage Management",
      "BA in Governance & Development Studies",
      "BA in Journalism",
      "BA in Kambatisa",
      "MA in Teaching English as a Foreign Language (TEFL)",
      "MA in Peace and Conflict Studies",
      "MSc in Geography and Environmental Science",
      "MA in Social Anthropology",
      "MA in Applied Linguistics and Communication in Hadiyyisa"
    ],
    "ትምህርትና ባህሪ ሳይንስ ኮሌጅ (College of Education & Behavioral Science)": [
      "BA in Psychology",
      "BA in Educational Leadership and Management",
      "BA in Special Needs and Inclusive Education",
      "MA in Educational Leadership and Management (EDPM)",
      "PhD in Educational Leadership and Policy Studies"
    ],
    "የሕግ ትምህርት ቤት (School of Law)": [
      "BA in Law (LLB)",
      "LLM in Environmental Law and policy"
    ],
    "የእንስሳት ሕክምና ትምህርት ቤት (School of Veterinary Medicine)": [
      "Doctor of Veterinary Medicine (DVM)",
      "BSc in Veterinary Science"
    ]
  },

  "አዲስ አበባ ዩኒቨርሲቲ (Addis Ababa University - AAU)": {
    "ቴክኖሎጂ ኢንስቲትዩት (AAiT)": [
      "BSc in Civil Engineering",
      "BSc in Electrical and Computer Engineering",
      "BSc in Mechanical Engineering",
      "BSc in Chemical Engineering",
      "BSc in Software Engineering",
      "BSc in Information Technology",
      "BSc in Biomedical Engineering"
    ],
    "ጤና ሳይንስ ኮሌጅ (College of Health Sciences)": [
      "Doctor of Medicine (MD)",
      "Doctor of Dental Medicine (DMD)",
      "BSc in Pharmacy",
      "BSc in Nursing",
      "BSc in Midwifery",
      "BSc in Medical Laboratory Sciences",
      "BSc in Anesthesia",
      "BSc in Public Health"
    ],
    "ተፈጥሮና ቀመር ሳይንስ ኮሌጅ (College of Natural and Computational Sciences)": [
      "BSc in Computer Science",
      "BSc in Information Systems",
      "BSc in Biology",
      "BSc in Chemistry",
      "BSc in Physics",
      "BSc in Mathematics",
      "BSc in Statistics",
      "BSc in Earth Sciences",
      "BSc in Environmental Science"
    ],
    "ቢዝነስና ኢኮኖሚክስ ኮሌጅ (College of Business and Economics)": [
      "BA in Accounting and Finance",
      "BA in Economics",
      "BA in Management",
      "BA in Public Administration"
    ],
    "ማኅበራዊ ሳይንስ ኮሌጅ (College of Social Sciences)": [
      "BA in Political Science and International Relations",
      "BA in Social Anthropology",
      "BA in Sociology",
      "BA in Geography and Environmental Studies",
      "BA in History",
      "BA in Philosophy"
    ],
    "ሂዩማኒቲስ፣ የቋንቋ ጥናትና ጋዜጠኝነት (Humanities, Language Studies & Journalism)": [
      "BA in Journalism and Communication",
      "BA in English Language and Literature",
      "BA in Amharic Language and Literature",
      "BA in Afaan Oromoo",
      "BA in Tigrinya",
      "BA in Linguistics",
      "BA in Theatrical Arts"
    ],
    "ህግና መልካም አስተዳደር (Law and Governance)": [
      "Bachelor of Laws (LLB)"
    ],
    "ትምህርትና ባህሪ ጥናት ኮሌጅ (College of Education and Behavioral Studies)": [
      "BA in Psychology",
      "BA in Special Needs Education",
      "BA in Educational Planning and Management"
    ],
    "እንስሳት ሕክምናና ግብርና ኮሌጅ (Veterinary Medicine and Agriculture)": [
      "Doctor of Veterinary Medicine (DVM)",
      "BSc in Veterinary Laboratory Technology"
    ]
  },

  "ጅማ ዩኒቨርሲቲ (Jimma University - JU)": {
    "ቴክኖሎጂ ኢንስቲትዩት (JiT)": [
      "BSc in Civil Engineering",
      "BSc in Electrical and Computer Engineering",
      "BSc in Mechanical Engineering",
      "BSc in Biomedical Engineering",
      "BSc in Computing",
      "BSc in Software Engineering",
      "BSc in Information Technology"
    ],
    "ጤና ኢንስቲትዩት (Institute of Health)": [
      "Doctor of Medicine (MD)",
      "BSc in Pharmacy",
      "BSc in Nursing",
      "BSc in Environmental Health",
      "BSc in Medical Laboratory Science",
      "BSc in Public Health",
      "Doctor of Dental Medicine (DMD)"
    ],
    "ግብርናና እንስሳት ሕክምና ኮሌጅ (JUCAVM)": [
      "Doctor of Veterinary Medicine (DVM)",
      "BSc in Agriculture (Plant Science)",
      "BSc in Animal Science",
      "BSc in Horticulture",
      "BSc in Agribusiness and Value Chain Management"
    ],
    "ቢዝነስና ኢኮኖሚክስ ኮሌጅ (College of Business and Economics)": [
      "BA in Accounting",
      "BA in Management",
      "BA in Economics",
      "BA in Banking and Finance"
    ],
    "ተፈጥሮ ሳይንስ ኮሌጅ (College of Natural Sciences)": [
      "BSc in Biology",
      "BSc in Chemistry",
      "BSc in Physics",
      "BSc in Mathematics",
      "BSc in Statistics",
      "BSc in Sport Science"
    ],
    "ማኅበራዊ ሳይንስና ሂዩማኒቲስ ኮሌጅ (College of Social Sciences and Humanities)": [
      "BA in Sociology",
      "BA in Psychology",
      "BA in History and Heritage Management",
      "BA in English Language and Literature",
      "BA in Geography"
    ],
    "ህግና መልካም አስተዳደር ኮሌጅ (College of Law and Governance)": [
      "Bachelor of Laws (LLB)",
      "BA in Governance and Development Studies"
    ]
  },

  "ባሕር ዳር ዩኒቨርሲቲ (Bahir Dar University - BDU)": {
    "ቴክኖሎጂ ኢንስቲትዩት (BiT)": [
      "BSc in Civil Engineering",
      "BSc in Electrical and Computer Engineering",
      "BSc in Mechanical Engineering",
      "BSc in Chemical Engineering",
      "BSc in Computer Engineering",
      "BSc in Information Technology",
      "BSc in Software Engineering"
    ],
    "ሕክምናና ጤና ሳይንስ ኮሌጅ (College of Medicine and Health Sciences)": [
      "Doctor of Medicine (MD)",
      "BSc in Nursing",
      "BSc in Midwifery",
      "BSc in Pharmacy",
      "BSc in Public Health"
    ],
    "ግብርናና አካባቢ ሳይንስ ኮሌጅ (College of Agriculture and Environmental Sciences)": [
      "BSc in Plant Science",
      "BSc in Animal Science",
      "BSc in Natural Resource Management",
      "BSc in Disaster Risk Management"
    ],
    "College of Business and Economics": [
      "BA in Accounting and Finance",
      "BA in Management",
      "BA in Economics",
      "BA in Marketing Management",
      "BA in Tourism and Hotel Management"
    ],
    "ሳይንስ ኮሌጅ (College of Science)": [
      "BSc in Biology",
      "BSc in Chemistry",
      "BSc in Physics",
      "BSc in Mathematics",
      "BSc in Statistics"
    ],
    "ሂዩማኒቲስ ፋኩልቲ (Faculty of Humanities)": [
      "BA in Amharic",
      "BA in English",
      "BA in Journalism and Communications"
    ],
    "ማኅበራዊ ሳይንስ ፋኩልቲ (Faculty of Social Sciences)": [
      "BA in Geography and Environmental Studies",
      "BA in History and Heritage Management",
      "BA in Political Science and International Studies"
    ],
    "የሕግ ትምህርት ቤት (School of Law)": [
      "Bachelor of Laws (LLB)"
    ],
    "ትምህርትና ባህሪ ሳይንስ ኮሌጅ (College of Education and Behavioral Sciences)": [
      "BA in Psychology",
      "BA in Special Needs Education"
    ]
  },

  "ሐዋሳ ዩኒቨርሲቲ (Hawassa University - HU)": {
    "ቴክኖሎጂ ኢንስቲትዩት (IoT)": [
      "BSc in Civil Engineering",
      "BSc in Electrical and Computer Engineering",
      "BSc in Mechanical Engineering",
      "BSc in Water Resources Engineering",
      "BSc in Computer Science",
      "BSc in Information Technology",
      "BSc in Software Engineering"
    ],
    "College of Medicine and Health Sciences": [
      "Doctor of Medicine (MD)",
      "BSc in Nursing",
      "BSc in Midwifery",
      "BSc in Public Health",
      "BSc in Medical Laboratory Science",
      "BSc in Environmental Health"
    ],
    "ግብርና ኮሌጅ (College of Agriculture)": [
      "BSc in Plant Science",
      "BSc in Animal Science",
      "BSc in Rural Development and Agricultural Extension",
      "BSc in Agribusiness"
    ],
    "ወንዶ ገነት የደንና ተፈጥሮ ሃብት ኮሌጅ (Wondo Genet College)": [
      "BSc in Forestry",
      "BSc in Natural Resource Management",
      "BSc in Wildlife Management"
    ],
    "College of Business and Economics": [
      "BA in Accounting and Finance",
      "BA in Management",
      "BA in Economics",
      "BA in Cooperatives"
    ],
    "ተፈጥሮና ቀመር ሳይንስ ኮሌጅ (College of Natural and Computational Sciences)": [
      "BSc in Biology",
      "BSc in Chemistry",
      "BSc in Physics",
      "BSc in Mathematics",
      "BSc in Statistics",
      "BSc in Sport Science"
    ],
    "College of Social Sciences and Humanities": [
      "BA in Sociology",
      "BA in Anthropology",
      "BA in English Language and Literature",
      "BA in Journalism and Communication"
    ],
    "College of Law and Governance": [
      "Bachelor of Laws (LLB)"
    ]
  },

  "ጎንደር ዩኒቨርሲቲ (University of Gondar - UoG)": {
    "College of Medicine and Health Sciences": [
      "Doctor of Medicine (MD)",
      "BSc in Pharmacy",
      "BSc in Nursing",
      "BSc in Midwifery",
      "BSc in Medical Laboratory Sciences",
      "BSc in Environmental and Occupational Health",
      "BSc in Optometry",
      "BSc in Physiotherapy",
      "BSc in Psychiatry Nursing",
      "BSc in Public Health"
    ],
    "ቴክኖሎጂ ኢንስቲትዩት (Institute of Technology)": [
      "BSc in Civil Engineering",
      "BSc in Electrical and Computer Engineering",
      "BSc in Mechanical Engineering",
      "BSc in Industrial Engineering",
      "BSc in Computer Science",
      "BSc in Information Technology",
      "BSc in Information Systems"
    ],
    "College of Agriculture and Environmental Sciences": [
      "BSc in Plant Science",
      "BSc in Animal Science",
      "BSc in Natural Resource Management",
      "BSc in Agricultural Economics"
    ],
    "እንስሳት ሕክምናና ሳይንስ ኮሌጅ (Veterinary Medicine and Animal Sciences)": [
      "Doctor of Veterinary Medicine (DVM)",
      "BSc in Veterinary Pharmacy"
    ],
    "College of Business and Economics": [
      "BA in Accounting and Finance",
      "BA in Management",
      "BA in Economics",
      "BA in Tourism Management"
    ],
    "College of Natural and Computational Sciences": [
      "BSc in Biology",
      "BSc in Chemistry",
      "BSc in Physics",
      "BSc in Mathematics",
      "BSc in Statistics",
      "BSc in Biotechnology"
    ],
    "College of Social Sciences and Humanities": [
      "BA in Sociology",
      "BA in Psychology",
      "BA in History and Heritage Management",
      "BA in Geography and Environmental Studies",
      "BA in English Language and Literature"
    ],
    "School of Law": [
      "Bachelor of Laws (LLB)"
    ]
  },
  //Debre Berhan University
  "ደብረ ብርሃን ዩኒቨርሲቲ (Debre Berhan University - DBU)": {
    "ኢንጂነሪንግ ኮሌጅ (College of Engineering)": [
      "ሲቪል ኢንጂነሪንግ (Civil Engineering)",
      "ኤሌክትሪካልና ኮምፒውተር ኢንጂነሪንግ (Electrical and Computer Engineering)",
      "ሜካኒካል ኢንጂነሪንግ (Mechanical Engineering)",
      "ኬሚካል ኢንጂነሪንግ (Chemical Engineering)",
      "ኮንስትራክሽን ቴክኖሎጂና ማኔጅመንት (Construction Technology and Management - CoTM)",
      "አርክቴክቸር (Architecture)",
    ],
    "ኮምፒውቲንግ ኮሌጅ (College of Computing)": [
      "ኮምፒውተር ሳይንስ (Computer Science)",
      "ኢንፎርሜሽን ቴክኖሎጂ (Information Technology)",
      "ኢንፎርሜሽን ሲስተም (Information System)",
      "ሶፍትዌር ኢንጂነሪንግ (Software Engineering)",
    ],
    "ጤና ሳይንስ ኮሌጅ (College of Health Sciences)": [
      "ሕክምና (Medicine)",
      "ነርሲንግ (Nursing)",
      "ሚድዋይፈሪ (Midwifery)",
      "ሕዝብ ጤና (Public Health)",
      "ሜዲካል ላቦራቶሪ ሳይንስ (Medical Laboratory Science)",
    ],
    "ግብርናና ተፈጥሮ ሃብት ሳይንስ ኮሌጅ (College of Agriculture and Natural Resource Sciences)":
      [
        "የዕፅዋት ሳይንስ (Plant Science)",
        "የእንስሳት ሳይንስ (Animal Science)",
        "ሆርቲካልቸር (Horticulture)",
        "የተፈጥሮ ሃብት ማኔጅመንት (Natural Resource Management)",
      ],
    "ቢዝነስና ኢኮኖሚክስ ኮሌጅ (College of Business and Economics)": [
      "አካውንቲንግና ፋይናንስ (Accounting and Finance)",
      "ማኔጅመንት (Management)",
      "ኢኮኖሚክስ (Economics)",
      "ማርኬቲንግ ማኔጅመንት (Marketing Management)",
      "ቱሪዝምና ሆቴል ማኔጅመንት (Tourism and Hotel Management)",
    ],
    "ተፈጥሮና ቀመር ሳይንስ ኮሌጅ (College of Natural and Computational Sciences)": [
      "ባዮሎጂ (Biology)",
      "ኬሚስትሪ (Chemistry)",
      "ፊዚክስ (Physics)",
      "ሒሳብ (Mathematics)",
      "ስታቲስቲክስ (Statistics)",
    ],
  },

  //Wollo University
  "ወሎ ዩኒቨርሲቲ (Wollo University - WU)": {
    "ኮምቦልቻ ቴክኖሎጂ ኢንስቲትዩት (Kombolcha Institute of Technology - KIOT)": [
      "ሲቪል ኢንጂነሪንግ (Civil Engineering)",
      "ኤሌክትሪካልና ኮምፒውተር ኢንጂነሪንግ (Electrical and Computer Engineering)",
      "ሜካኒካል ኢንጂነሪንግ (Mechanical Engineering)",
      "ኢንዳስትሪያል ኢንጂነሪንግ (Industrial Engineering)",
      "ጨርቃጨርቅና አልባሳት ኢንጂነሪንግ (Textile and Apparel Engineering)",
      "ሶፍትዌር ኢንጂነሪንግ (Software Engineering)",
      "ኬሚካል ኢንጂነሪንግ (Chemical Engineering)",
      "ውኃ ሃብትና አካባቢ ኢንጂነሪንግ (Water Resources and Environmental Engineering)",
    ],
    "ኢንፎርማቲክስ ትምህርት ቤት (School of Informatics - Dessie Campus)": [
      "ኮምፒውተር ሳይንስ (Computer Science)",
      "ኢንፎርሜሽን ቴክኖሎጂ (Information Technology)",
      "ኢንፎርሜሽን ሲስተም (Information System)",
    ],
    "ሕክምናና ጤና ሳይንስ ኮሌጅ (College of Medicine and Health Sciences)": [
      "ሕክምና (Medicine)",
      "ፋርማሲ (Pharmacy)",
      "ነርሲንግ (Nursing)",
      "ሚድዋይፈሪ (Midwifery)",
      "የሕዝብ ጤና (Public Health)",
      "የሕክምና ላቦራቶሪ ሳይንስ (Medical Laboratory Science)",
    ],
    "ቢዝነስና ኢኮኖሚክስ ኮሌጅ (College of Business and Economics)": [
      "አካውንቲንግና ፋይናንስ (Accounting and Finance)",
      "ማኔጅመንት (Management)",
      "ኢኮኖሚክስ (Economics)",
      "ማርኬቲንግ ማኔጅመንት (Marketing Management)",
      "ቱሪዝምና ሆቴል ማኔጅመንት (Tourism and Hotel Management)",
    ],
    "ግብርና ኮሌጅ (College of Agriculture)": [
      "የዕፅዋት ሳይንስ (Plant Science)",
      "የእንስሳት ሳይንስ (Animal Science)",
      "የተፈጥሮ ሃብት ማኔጅመንት (Natural Resource Management)",
    ],
    "ተፈጥሮ ሳይንስ ኮሌጅ (College of Natural Sciences)": [
      "ባዮሎጂ (Biology)",
      "ኬሚስትሪ (Chemistry)",
      "ፊዚክስ (Physics)",
      "ሒሳብ (Mathematics)",
      "ስታቲስቲክስ (Statistics)",
    ],
  },

  //Dire Dawa University
  "ድሬዳዋ ዩኒቨርሲቲ (Dire Dawa University - DDU)": {
    "ቴክኖሎጂ ኢንስቲትዩት (Institute of Technology - IoT)": [
      "ሲቪል ኢንጂነሪንግ (Civil Engineering)",
      "ኤሌክትሪካልና ኮምፒውተር ኢንጂነሪንግ (Electrical and Computer Engineering)",
      "ሜካኒካል ኢንጂነሪንግ (Mechanical Engineering)",
      "ኬሚካል ኢንጂነሪንግ (Chemical Engineering)",
      "ኮንስትራክሽን ቴክኖሎጂና ማኔጅመንት (Construction Technology and Management - CoTM)",
    ],
    "ኮምፒውቲንግና ኢንፎርማቲክስ ኮሌጅ (College of Computing and Informatics)": [
      "ኮምፒውተር ሳይንስ (Computer Science)",
      "ኢንፎርሜሽን ቴክኖሎጂ (Information Technology)",
      "ኢንፎርሜሽን ሲስተም (Information System)",
      "ሶፍትዌር ኢንጂነሪንግ (Software Engineering)",
    ],
    "ሕክምናና ጤና ሳይንስ ኮሌጅ (College of Medicine and Health Sciences)": [
      "ሕክምና (Medicine)",
      "ነርሲንግ (Nursing)",
      "ሕዝብ ጤና (Public Health)",
      "ሚድዋይፈሪ (Midwifery)",
    ],
    "ቢዝነስና ኢኮኖሚክስ ኮሌጅ (College of Business and Economics)": [
      "አካውንቲንግና ፋይናንስ (Accounting and Finance)",
      "ማኔጅመንት (Management)",
      "ኢኮኖሚክስ (Economics)",
      "ሎጅስቲክስና ሰፕላይ ቼይን ማኔጅመንት (Logistics and Supply Chain Management)",
    ],
    "ህግ ኮሌጅ (College of Law)": ["ህግ (Law)"],
  },
  "ደብረ ማርቆስ ዩኒቨርሲቲ (Debre Markos University - DMU)": {
    "ሀዳር ቴክኖሎጂ ኢንስቲትዩት (Hadar Institute of Technology - HIT)": [
      "ሲቪል ኢንጂነሪንግ (Civil Engineering)",
      "ኤሌክትሪካልና ኮምፒውተር ኢንጂነሪንግ (Electrical and Computer Engineering)",
      "ሜካኒካል ኢንጂነሪንግ (Mechanical Engineering)",
      "ኬሚካል ኢንጂነሪንግ (Chemical Engineering)",
      "ኮንስትራክሽን ቴክኖሎጂና ማኔጅመንት (Construction Technology and Management - CoTM)",
      "ኮምፒውተር ሳይንስ (Computer Science)",
      "ኢንፎርሜሽን ቴክኖሎጂ (Information Technology)",
      "ሶፍትዌር ኢንጂነሪንግ (Software Engineering)",
    ],
    "ሕክምናና ጤና ሳይንስ ኮሌጅ (College of Medicine and Health Sciences)": [
      "ሕክምና (Medicine)",
      "ነርሲንግ (Nursing)",
      "ሚድዋይፈሪ (Midwifery)",
      "ሕዝብ ጤና (Public Health)",
      "ፋርማሲ (Pharmacy)",
    ],
    "ግብርናና ተፈጥሮ ሃብት ኮሌጅ (College of Agriculture and Natural Resources)": [
      "የዕፅዋት ሳይንስ (Plant Science)",
      "የእንስሳት ሳይንስ (Animal Science)",
      "ተፈጥሮ ሃብት ማኔጅመንት (Natural Resource Management)",
    ],
    "ቢዝነስና ኢኮኖሚክስ ኮሌጅ (College of Business and Economics)": [
      "አካውንቲንግና ፋይናንስ (Accounting and Finance)",
      "ማኔጅመንት (Management)",
      "ኢኮኖሚክስ (Economics)",
    ],
    "ተፈጥሮና ቀመር ሳይንስ ኮሌጅ (College of Natural and Computational Sciences)": [
      "ባዮሎጂ (Biology)",
      "ኬሚስትሪ (Chemistry)",
      "ፊዚክስ (Physics)",
      "ሒሳብ (Mathematics)",
      "ስታቲስቲክስ (Statistics)",
    ],
  },
};
