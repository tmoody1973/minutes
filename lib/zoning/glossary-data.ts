// Plain-English glossary for the project page's "What would change" section.
//
// Rules (Rulings 36, 37): `officialText` is copied VERBATIM from the Milwaukee Code of Ordinances, ch. 295 (Zoning),
// published by the City Clerk at city.milwaukee.gov; `officialUrl` is that PDF (with #page=N) and `section` the
// code section. `plain` is a draft that may only restate its own `officialText`, and the builder must approve it
// (`approved: true`) before the UI shows it. Never write an official definition from memory: if it cannot be found,
// list it in NOT_FOUND instead. Excerpts are saved in tests/fixtures/zoning-code/ and tests check each officialText.
// Data only: UI code must not import this module; it reads entries through `lookup` in glossary.ts.

export interface GlossaryEntry {
  term: string;
  code?: string;
  plain: string;
  approved: boolean;
  officialText: string;
  officialUrl: string;
  section: string;
}

export const GLOSSARY_DATA: Record<string, GlossaryEntry> = {
  "PD": {
    term: "Planned Development",
    code: "PD",
    plain: "A Planned Development is a district intended to allow flexibility in land development, promote creativity and variety, and encourage development compatible with its surroundings.",
    approved: true,
    officialText: "The planned development district is intended to: a. Allow flexibility in land development. b. Promote creativity, variety and environmental sensitivity. c. Encourage development compatible with its surroundings and consistent with the city's comprehensive plan.",
    officialUrl: "https://city.milwaukee.gov/ImageLibrary/Groups/ccClerk/Ordinances/Volume-2/CH295-sub9.pdf#page=19",
    section: "295-907-1",
  },
  "GPD": {
    term: "General Planned Development",
    code: "GPD",
    plain: "A general plan covers the entire tract when development will proceed in stages over an extended period; separate detailed plans for each stage then follow the general plan.",
    approved: true,
    officialText: "If actual development of the project is to proceed in stages over an extended period of time, the applicant shall first submit a general plan covering the entire tract. Separate detailed plans shall then be submitted for each stage of development and shall follow the development concept established by the general plan. If development of the project is not to be done in stages, a general plan is optional and a single detailed plan may be submitted in lieu thereof.",
    officialUrl: "https://city.milwaukee.gov/ImageLibrary/Groups/ccClerk/Ordinances/Volume-2/CH295-sub9.pdf#page=19",
    section: "295-907-2-a",
  },
  "DPD": {
    term: "Detailed Planned Development",
    code: "DPD",
    plain: "No building permits may be issued and no site work may begin until common council approves a detailed plan and a copy of the ordinance has been certified.",
    approved: true,
    officialText: "Within any planned development district, no building permits may be issued and no site work may be commenced until a detailed plan has been approved by the common council and a copy of the ordinance has been certified by the city clerk.",
    officialUrl: "https://city.milwaukee.gov/ImageLibrary/Groups/ccClerk/Ordinances/Volume-2/CH295-sub9.pdf#page=21",
    section: "295-907-2-j",
  },
  "minor modification": {
    term: "Minor modification (to a Detailed Planned Development)",
    plain: "Modifications may be approved if consistent with the spirit and intent of the general or previously approved detailed plan and, among other conditions, will not change the general character.",
    approved: true,
    officialText: "Minor Modifications. The common council may by resolution approve modifications to approved detailed plans which are consistent with the spirit and intent of the general planned development or a previously approved detailed planned development provided the common council finds that the modification will not: i-1. Change the general character of the planned development. i-2. Cause a substantial relocation of principal or accessory structures. i-3. Cause a substantial relocation or reduction of parking, loading or recreation areas. i-4. Cause a substantial relocation of traffic facilities. i-5. Increase the land coverage of buildings and parking areas. i-6. Increase the gross floor area of buildings or the number of dwelling units. i-7. Reduce the amount of approved open space, landscaping or screening.",
    officialUrl: "https://city.milwaukee.gov/ImageLibrary/Groups/ccClerk/Ordinances/Volume-2/CH295-sub9.pdf#page=21",
    section: "295-907-2-i",
  },
  "special use": {
    term: "Special use",
    plain: "A special use is generally acceptable in a district but needs case-by-case review to decide whether it is permitted, conditionally permitted or denied.",
    approved: true,
    officialText: "SPECIAL USE means a use which is generally acceptable in a particular zoning district but which, because of its characteristics and the characteristics of the zoning district in which it would be located, requires review on a case-by-case basis to determine whether it should be permitted, conditionally permitted or denied.",
    officialUrl: "https://city.milwaukee.gov/ImageLibrary/Groups/ccClerk/Ordinances/Volume-2/CH295-sub2.pdf#page=21",
    section: "295-201-619",
  },
  "variance, dimensional": {
    term: "Variance (dimensional)",
    plain: "A dimensional variance is permission from the board to depart from requirements other than use regulations, such as area, setback, frontage, height, bulk, density or design.",
    approved: true,
    officialText: "VARIANCE, DIMENSIONAL means permission from the board to depart from any of the literal requirements of this chapter except use regulations, including but not limited to a departure from an area, setback, frontage, height, bulk, density or design requirement.",
    officialUrl: "https://city.milwaukee.gov/ImageLibrary/Groups/ccClerk/Ordinances/Volume-2/CH295-sub2.pdf#page=24",
    section: "295-201-675",
  },
  "variance, use": {
    term: "Variance (use)",
    plain: "A use variance is permission from the board to depart from any of the use regulations of the chapter.",
    approved: true,
    officialText: "VARIANCE, USE means permission from the board to depart from any of the use regulations of this chapter.",
    officialUrl: "https://city.milwaukee.gov/ImageLibrary/Groups/ccClerk/Ordinances/Volume-2/CH295-sub2.pdf#page=24",
    section: "295-201-676",
  },
  "RS2": {
    term: "Single-Family Residential (RS1-RS5)",
    code: "RS2",
    plain: "RS2 is one of the RS1-RS5 districts, meant for single-family dwellings.",
    approved: true,
    officialText: "RS1-RS5 Districts. The purpose of the RS1-RS5 districts is to promote, preserve and protect neighborhoods intended for single-family dwellings and having a character slightly more suburban than the RS6 district. These districts require larger lots, larger setbacks and a smaller lot coverage than the RS6 district. The neighborhoods found in these districts feature a regular platting pattern and a more uniform pattern of development than those of the RS6 district. These neighborhoods were platted and developed, in large part, in the mid- to late-1900s, with some areas recently developed.",
    officialUrl: "https://city.milwaukee.gov/ImageLibrary/Groups/ccClerk/Ordinances/Volume-2/CH295-sub5.pdf#page=1",
    section: "295-501-1-a",
  },
  "RT3": {
    term: "Two-Family Residential (RT3)",
    code: "RT3",
    plain: "RT3 is a residential district meant mainly for two-family homes.",
    approved: true,
    officialText: "RT3 District. The purpose of the RT3 district is to promote, preserve and protect neighborhoods intended primarily for two-family dwellings with a traditional urban character. This district, much like the RT4 district, allows smaller lots, smaller setbacks and a higher lot coverage than the RT1 and RT2 districts. However, it does not allow the establishment of new, multi-family buildings. The neighborhoods in this district were platted and developed, in large part, in the early 1900s and tend to be more uniform than those of the RT4 district.",
    officialUrl: "https://city.milwaukee.gov/ImageLibrary/Groups/ccClerk/Ordinances/Volume-2/CH295-sub5.pdf#page=1",
    section: "295-501-2-b",
  },
  "RT4": {
    term: "Two-Family Residential (RT4)",
    code: "RT4",
    plain: "RT4 is a residential district meant mainly for two-family homes, and it also allows single-family homes and buildings of three or four units.",
    approved: true,
    officialText: "RT4 District. The purpose of the RT4 district is to promote, preserve and protect neighborhoods intended primarily for 2-family dwellings while also permitting a mixture of single-family dwellings and small multi-family dwellings of 3 or 4 units. This district, much like the RT3 district, allows smaller lots, smaller setbacks and a higher lot coverage than the RT1 and RT2 districts. The neighborhoods found in this district were platted and developed, in large part, in the late 1800s and early 1900s. This district also allows traditional corner commercial establishments commonly found in urban neighborhoods.",
    officialUrl: "https://city.milwaukee.gov/ImageLibrary/Groups/ccClerk/Ordinances/Volume-2/CH295-sub5.pdf#page=1",
    section: "295-501-2-c",
  },
  "RM3": {
    term: "Multi-Family Residential (RM3)",
    code: "RM3",
    plain: "RM3 is a district meant mainly for medium-density residential uses with an urban character.",
    approved: true,
    officialText: "RM3 District. The purpose of the RM3 district is to promote, preserve, and protect neighborhoods intended primarily for medium-density residential uses with an urban character. This district, much like the RM4-RM7 districts, allows smaller lots, smaller setbacks and higher lot coverage than the RM1-RM2 districts. However, the neighborhoods in this district were platted and developed, in large part, in the early 1900s and tend to be more uniform and of a lower density than those of the RM4-RM7 districts. This district also allows traditional corner commercial establishments commonly found in urban neighborhoods.",
    officialUrl: "https://city.milwaukee.gov/ImageLibrary/Groups/ccClerk/Ordinances/Volume-2/CH295-sub5.pdf#page=2",
    section: "295-501-3-b",
  },
  "RM6": {
    term: "Multi-Family Residential (RM4-RM7)",
    code: "RM6",
    plain: "RM6 is one of the RM4-RM7 districts, meant mainly for high-density multi-family residential uses.",
    approved: true,
    officialText: "RM4-RM7 Districts. The purpose of the RM4-RM7 districts is to promote, preserve and protect neighborhoods intended primarily for high-density multi-family residential uses. These districts allow a wide range of lot sizes, smaller setbacks, and a high percentage of lot coverage. They also allow neighborhood-serving commercial establishments commonly found in urban neighborhoods.",
    officialUrl: "https://city.milwaukee.gov/ImageLibrary/Groups/ccClerk/Ordinances/Volume-2/CH295-sub5.pdf#page=2",
    section: "295-501-3-c",
  },
  "NS2": {
    term: "Neighborhood Shopping (NS2)",
    code: "NS2",
    plain: "NS2 is a neighborhood shopping district: residential uses plus commercial uses serving the neighborhood, in a more urban pattern with smaller lots and smaller setbacks.",
    approved: true,
    officialText: "NEIGHBORHOOD SHOPPING DISTRICTS (NS1-NS2). These districts provide for residential uses as well as commercial uses that serve the neighborhood. Such commercial uses are necessary to satisfy basic shopping and service needs that occur frequently and must, therefore, be located close to residential areas. The character of these districts is intended to be compatible with that of surrounding residential neighborhoods. Buildings in these districts are typically smaller in scale than those found in local business districts. The NS1 district is characterized by a more suburban development pattern, with larger lots and deeper setbacks, while the development pattern in the NS2 district tends to be more urban, with smaller lots and smaller setbacks.",
    officialUrl: "https://city.milwaukee.gov/ImageLibrary/Groups/ccClerk/Ordinances/Volume-2/CH295-sub6.pdf#page=1",
    section: "295-601-1",
  },
  "LB1": {
    term: "Local Business (LB1)",
    code: "LB1",
    plain: "LB1 is a local business district providing a wide range of goods and services, in a more suburban pattern with larger lots and deeper setbacks.",
    approved: true,
    officialText: "LOCAL BUSINESS DISTRICTS (LB1-LB3). These districts provide a wide range of goods and services to a large consumer population coming from an extensive area. Within these districts, motor-vehicle-related activities are of major significance. Good access by motor vehicle or public transit is important to local business districts, which are often located adjacent to intersections of major thoroughfares and in close proximity to bus transfer locations. The LB1 district is characterized by a more suburban development pattern, with larger lots and deeper setbacks, while the development pattern in the LB2 district tends to be more urban, with smaller lots and smaller setbacks. The LB3 district is the most urban and is characterized by design standards appropriate for neighborhood commercial hubs, centers, corridors and transit-oriented development areas that have a denser level of development and may have taller buildings, all of which promote compact, walkable, sustainable neighborhoods.",
    officialUrl: "https://city.milwaukee.gov/ImageLibrary/Groups/ccClerk/Ordinances/Volume-2/CH295-sub6.pdf#page=1",
    section: "295-601-2",
  },
  "LB2": {
    term: "Local Business (LB2)",
    code: "LB2",
    plain: "LB2 is a local business district providing a wide range of goods and services, in a more urban pattern with smaller lots and smaller setbacks.",
    approved: true,
    officialText: "LOCAL BUSINESS DISTRICTS (LB1-LB3). These districts provide a wide range of goods and services to a large consumer population coming from an extensive area. Within these districts, motor-vehicle-related activities are of major significance. Good access by motor vehicle or public transit is important to local business districts, which are often located adjacent to intersections of major thoroughfares and in close proximity to bus transfer locations. The LB1 district is characterized by a more suburban development pattern, with larger lots and deeper setbacks, while the development pattern in the LB2 district tends to be more urban, with smaller lots and smaller setbacks. The LB3 district is the most urban and is characterized by design standards appropriate for neighborhood commercial hubs, centers, corridors and transit-oriented development areas that have a denser level of development and may have taller buildings, all of which promote compact, walkable, sustainable neighborhoods.",
    officialUrl: "https://city.milwaukee.gov/ImageLibrary/Groups/ccClerk/Ordinances/Volume-2/CH295-sub6.pdf#page=1",
    section: "295-601-2",
  },
  "IO1": {
    term: "Industrial-Office (IO1)",
    code: "IO1",
    plain: "IO1 is the newer part of the industrial-office district, in the form of office-industrial parks or business parks with campus-style layouts.",
    approved: true,
    officialText: "INDUSTRIAL-OFFICE (IO). This district provides sites for modern, clean industry and supporting, non-residential land uses that complement industrial uses or require an industrial environment. Older portions of this zoning district (IO2) often form corridors which provide a buffer between residential areas and more intensive industrial districts. The newer portions of this district (IO1) are in the form of office-industrial parks or business parks with campus-style layouts and designs. The IO district has a performance-oriented transition area where it adjoins residential neighborhoods. Buffering and other requirements in the transition area are intended to protect the character of such neighborhoods.",
    officialUrl: "https://city.milwaukee.gov/ImageLibrary/Groups/ccClerk/Ordinances/Volume-2/CH295-sub8.pdf#page=1",
    section: "295-801-1",
  },
  "IL1": {
    term: "Industrial-Light (IL1)",
    code: "IL1",
    plain: "IL1 is the part of the industrial-light district made up of modern industrial parks.",
    approved: true,
    officialText: "INDUSTRIAL-LIGHT (IL). This district is intended to provide sites primarily for light industrial uses that utilize medium-sized buildings and do not have extensive outdoor storage areas or operations. This district includes both older industrial corridors (IL2) and modern industrial parks (IL1). While most buildings contain clean, light industrial uses, some commercial and office uses may also be included. This district contains heavier uses than the IO district and requires more extensive buffering from adjoining residential areas.",
    officialUrl: "https://city.milwaukee.gov/ImageLibrary/Groups/ccClerk/Ordinances/Volume-2/CH295-sub8.pdf#page=1",
    section: "295-801-2",
  },
  "IM": {
    term: "Industrial-Mixed (IM)",
    code: "IM",
    plain: "IM is a district intended for the orderly conversion of older industrial and warehousing areas to residential, commercial or office uses.",
    approved: true,
    officialText: "INDUSTRIAL-MIXED (IM). This district is intended to provide for the orderly conversion of certain older industrial and warehousing areas with multi-story buildings to residential, commercial or office uses for which the buildings, at the present time, may be better suited. These areas have an urban character. Buildings were typically built without setbacks or yards and often with little or no off-street parking.",
    officialUrl: "https://city.milwaukee.gov/ImageLibrary/Groups/ccClerk/Ordinances/Volume-2/CH295-sub8.pdf#page=1",
    section: "295-801-4",
  },
  "IH": {
    term: "Industrial-Heavy (IH)",
    code: "IH",
    plain: "IH is the industrial-heavy district, which accommodates high-intensity industry and uses that need large or isolated sites.",
    approved: true,
    officialText: "INDUSTRIAL-HEAVY (IH). This district accommodates high-intensity industry and often includes very large structures, extensive exterior storage, exterior mechanical operations, or heavy truck or equipment operations. It also accommodates uses that require large or isolated sites or harbor, airport or rail service. This district includes the historic industrial core of the city. It has a strong relationship to shipping and rail services and includes the port of Milwaukee, the Menomonee valley and various railroad corridors. Most sites within the IH district have already been developed or redeveloped. These sites seldom have excess land to provide buffer areas. Where possible, the IH district should be separated from residential neighborhoods with less intensive, non-residential districts.",
    officialUrl: "https://city.milwaukee.gov/ImageLibrary/Groups/ccClerk/Ordinances/Volume-2/CH295-sub8.pdf#page=1",
    section: "295-801-5",
  },
  "C9A(A)": {
    term: "High-Density Residential (C9A)",
    code: "C9A(A)",
    plain: "C9A is the high-density residential district, a highly urban living environment. (A) appears in the parcel record; chapter 295 does not define it.",
    approved: true,
    officialText: "HIGH-DENSITY RESIDENTIAL (C9A). The high-density residential district is designed and intended to serve as a highly urban living environment for those persons or families desirous of a residential location in close proximity to the city's downtown, as delineated in the city’s comprehensive plan.",
    officialUrl: "https://city.milwaukee.gov/ImageLibrary/Groups/ccClerk/Ordinances/Volume-2/CH295-sub7.pdf#page=1",
    section: "295-701-1",
  },
  "C9F(A)": {
    term: "Office and Service (C9F)",
    code: "C9F(A)",
    plain: "C9F, office and service: retail trade and personal and business services; major center of office commercial activities. (A) appears in the parcel record; chapter 295 does not define it.",
    approved: true,
    officialText: "OFFICE AND SERVICE (C9F). The office and service district is designed and intended to serve both as a retail trade and a personal and business services district, as well as a major center of office commercial activities.",
    officialUrl: "https://city.milwaukee.gov/ImageLibrary/Groups/ccClerk/Ordinances/Volume-2/CH295-sub7.pdf#page=1",
    section: "295-701-6",
  },
};

/** Terms we looked for in ch. 295 and could not honestly define from it. */
export const NOT_FOUND: ReadonlyArray<{ term: string; reason: string }> = [
  {
    term: "conditional use",
    reason:
      "Milwaukee's zoning code does not use the term. Its equivalent is \"special use\" (s. 295-201-619, approved by the Board of Zoning Appeals under s. 295-311-2), which has its own entry.",
  },
];

/** Zoning codes on the dev-data zoning matters (Convex dev, 2026-10-29) plus the MPROP fixtures. */
export const DEMO_CODES: ReadonlyArray<string> = ["PD", "GPD", "DPD", "RS2", "RT3", "RT4", "RM3", "RM6", "NS2", "LB1", "LB2", "IO1", "IL1", "IM", "IH", "C9A(A)", "C9F(A)"];

