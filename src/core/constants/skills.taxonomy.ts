export interface TaxonomySkillItem {
  name: string;
  aliases: string[];
  category: "CORE" | "SECONDARY" | "TOOL" | "DOMAIN" | "SOFT_SKILL";
  targetRoles: ("BUSINESS_ANALYST" | "DATA_ANALYST")[];
  description: string;
  defaultWeight: number;
}

export const BA_CORE_SKILLS: TaxonomySkillItem[] = [
  {
    name: "Requirements Engineering",
    aliases: ["BRD", "SRS", "FRD", "Requirement Gathering", "Requirement Elicitation", "Đặc tả yêu cầu", "Thu thập yêu cầu"],
    category: "CORE",
    targetRoles: ["BUSINESS_ANALYST"],
    description: "Khơi gợi, phân tích, đặc tả và quản lý tài liệu yêu cầu nghiệp vụ theo chuẩn BABOK",
    defaultWeight: 10,
  },
  {
    name: "Process Modeling (BPMN/UML)",
    aliases: ["BPMN", "BPMN 2.0", "UML", "Activity Diagram", "Sequence Diagram", "Use Case", "Quy trình nghiệp vụ", "Sơ đồ quy trình"],
    category: "CORE",
    targetRoles: ["BUSINESS_ANALYST"],
    description: "Mô hình hóa và chuẩn hóa luồng quy trình kinh doanh và hệ thống",
    defaultWeight: 9,
  },
  {
    name: "User Story & Acceptance Criteria",
    aliases: ["User Stories", "Acceptance Criteria", "Gherkin", "Given When Then", "Tiêu chí nghiệm thu"],
    category: "CORE",
    targetRoles: ["BUSINESS_ANALYST"],
    description: "Viết User Story và xác lập tiêu chuẩn nghiệm thu rõ ràng cho đội ngũ phát triển",
    defaultWeight: 8,
  },
  {
    name: "Data Mapping & ERD",
    aliases: ["Data Mapping", "ERD", "Entity Relationship", "Database Schema", "Sơ đồ thực thể", "Ánh xạ dữ liệu"],
    category: "CORE",
    targetRoles: ["BUSINESS_ANALYST", "DATA_ANALYST"],
    description: "Ánh xạ dữ liệu giữa các hệ thống và thiết kế mô hình dữ liệu quan hệ",
    defaultWeight: 8,
  },
  {
    name: "UAT & Solution Evaluation",
    aliases: ["UAT", "User Acceptance Testing", "Test Scenario", "Kiểm thử chấp nhận", "Nghiệm thu"],
    category: "CORE",
    targetRoles: ["BUSINESS_ANALYST"],
    description: "Lập kế hoạch kịch bản kiểm thử người dùng và đánh giá nghiệm thu giải pháp",
    defaultWeight: 7,
  },
  {
    name: "Stakeholder Management",
    aliases: ["Stakeholder Management", "Quản lý các bên liên quan", "Facilitation", "Đàm phán yêu cầu", "Phỏng vấn nghiệp vụ"],
    category: "SOFT_SKILL",
    targetRoles: ["BUSINESS_ANALYST"],
    description: "Giao tiếp, điều phối và dung hòa kỳ vọng giữa khối nghiệp vụ và khối kỹ thuật",
    defaultWeight: 7,
  },
];

export const DA_CORE_SKILLS: TaxonomySkillItem[] = [
  {
    name: "SQL (Advanced Querying)",
    aliases: ["SQL", "PostgreSQL", "MySQL", "MS SQL", "SQL Server", "T-SQL", "PL/SQL", "Window Functions", "CTEs", "Truy vấn SQL"],
    category: "CORE",
    targetRoles: ["DATA_ANALYST", "BUSINESS_ANALYST"],
    description: "Truy vấn, trích xuất, biến đổi và tối ưu dữ liệu từ các cơ sở dữ liệu quan hệ",
    defaultWeight: 10,
  },
  {
    name: "Power BI & DAX",
    aliases: ["Power BI", "PowerBI", "DAX", "Power Query", "M-Code", "Báo cáo Power BI", "SSAS"],
    category: "TOOL",
    targetRoles: ["DATA_ANALYST"],
    description: "Xây dựng mô hình dữ liệu BI, viết công thức DAX và tạo dashboard tương tác",
    defaultWeight: 9,
  },
  {
    name: "Customer Data Platform (CDP) & Customer 360",
    aliases: ["CDP", "Customer Data Platform", "Customer 360", "RFM", "Cohort", "Customer Insights", "Lead Scoring", "CLV", "Retention Analysis", "Phân tích khách hàng"],
    category: "CORE",
    targetRoles: ["DATA_ANALYST", "BUSINESS_ANALYST"],
    description: "Thiết kế nền tảng dữ liệu khách hàng tập trung, phân khúc RFM, cohort và hành trình khách hàng",
    defaultWeight: 9,
  },
  {
    name: "Data Quality & MDM",
    aliases: ["Data Quality", "MDM", "Master Data Management", "Data Standardization", "Deduplication", "Data Reconciliation", "Data Lineage", "Chuẩn hóa dữ liệu"],
    category: "CORE",
    targetRoles: ["DATA_ANALYST", "BUSINESS_ANALYST"],
    description: "Đảm bảo chất lượng dữ liệu, chuẩn hóa, chống trùng lặp và truy xuất nguồn gốc dữ liệu",
    defaultWeight: 8,
  },
  {
    name: "Tableau & Looker",
    aliases: ["Tableau", "Looker", "Looker Studio", "Google Data Studio"],
    category: "TOOL",
    targetRoles: ["DATA_ANALYST"],
    description: "Trực quan hóa dữ liệu và xây dựng báo cáo phân tích tự động",
    defaultWeight: 8,
  },
  {
    name: "Python for Data Analytics",
    aliases: ["Python", "Pandas", "NumPy", "Jupyter", "Matplotlib", "Seaborn"],
    category: "CORE",
    targetRoles: ["DATA_ANALYST"],
    description: "Xử lý dữ liệu dạng bảng, tự động hóa xử lý và phân tích thống kê bằng Python",
    defaultWeight: 9,
  },
  {
    name: "Data Modeling & Data Warehousing",
    aliases: ["Data Modeling", "Star Schema", "Snowflake Schema", "Data Warehouse", "DWH", "Kho dữ liệu", "Semantic Model"],
    category: "CORE",
    targetRoles: ["DATA_ANALYST"],
    description: "Thiết kế mô hình dữ liệu đa chiều phục vụ lưu trữ và phân tích kinh doanh",
    defaultWeight: 8,
  },
  {
    name: "Statistical Analysis & A/B Testing",
    aliases: ["Statistics", "Thống kê", "A/B Testing", "Hypothesis Testing", "Correlation", "Regression"],
    category: "CORE",
    targetRoles: ["DATA_ANALYST"],
    description: "Phân tích định lượng, kiểm định giả thuyết và đo lường tác động của tính năng",
    defaultWeight: 8,
  },
];

export const COMMON_TOOLS: TaxonomySkillItem[] = [
  {
    name: "Jira & Confluence",
    aliases: ["Jira", "Confluence", "Atlassian", "Quản lý backlog", "Sprint Planning"],
    category: "TOOL",
    targetRoles: ["BUSINESS_ANALYST", "DATA_ANALYST"],
    description: "Quản lý yêu cầu, tài liệu dự án và quy trình phát triển phần mềm",
    defaultWeight: 6,
  },
  {
    name: "API Analysis & Postman",
    aliases: ["API", "Postman", "REST API", "RESTful", "JSON", "Swagger", "Webhook", "API Integration", "Tích hợp hệ thống"],
    category: "TOOL",
    targetRoles: ["BUSINESS_ANALYST"],
    description: "Hiểu cấu trúc dữ liệu giao tiếp giữa các hệ thống phần mềm và thiết kế API contract",
    defaultWeight: 7,
  },
  {
    name: "Power Automate & Workflow Integration",
    aliases: ["Power Automate", "Workflow Automation", "Zapier", "Tự động hóa quy trình", "ETL Pipeline"],
    category: "TOOL",
    targetRoles: ["BUSINESS_ANALYST", "DATA_ANALYST"],
    description: "Xây dựng luồng tự động hóa quy trình và tích hợp dữ liệu tự động giữa các ứng dụng",
    defaultWeight: 6,
  },
  {
    name: "CRM & Omnichannel Messaging",
    aliases: ["CRM", "Omnichannel", "Zalo OA", "ZNS", "SMS Gateway", "Pancake", "Saleworks", "3CX", "Stringee", "Call Center Integration", "Tổng đài"],
    category: "TOOL",
    targetRoles: ["BUSINESS_ANALYST"],
    description: "Vận hành và tích hợp hệ thống CRM, tổng đài và tin nhắn chăm sóc khách hàng đa kênh",
    defaultWeight: 7,
  },
  {
    name: "Figma & UI Prototyping",
    aliases: ["Figma", "Wireframe", "Mockup", "Prototype", "Balsamiq", "Thiết kế giao diện mẫu"],
    category: "TOOL",
    targetRoles: ["BUSINESS_ANALYST"],
    description: "Tạo khung sườn và mẫu mô phỏng giao diện cho sản phẩm",
    defaultWeight: 6,
  },
  {
    name: "Advanced Excel",
    aliases: ["Excel", "Pivot Table", "VLOOKUP", "XLOOKUP", "VBA", "Bảng tính nâng cao"],
    category: "TOOL",
    targetRoles: ["BUSINESS_ANALYST", "DATA_ANALYST"],
    description: "Phân tích dữ liệu nhanh, mô hình tài chính và tự động hóa bảng tính",
    defaultWeight: 6,
  },
];

export const DOMAIN_KNOWLEDGE: TaxonomySkillItem[] = [
  {
    name: "Healthcare & Clinic Operations",
    aliases: ["Healthcare", "EMR", "HIS", "Hospital Information System", "Y tế", "Bệnh viện", "Phòng khám", "Hồ sơ bệnh án", "E-Signature", "Medical Records"],
    category: "DOMAIN",
    targetRoles: ["BUSINESS_ANALYST", "DATA_ANALYST"],
    description: "Nghiệp vụ hệ thống thông tin bệnh viện (HIS), bệnh án điện tử (EMR) và vận hành phòng khám",
    defaultWeight: 7,
  },
  {
    name: "E-Commerce & Retail",
    aliases: ["E-Commerce", "Retail", "Bán lẻ", "Thương mại điện tử", "Omnichannel", "POS", "Loyalty", "Khuyến mãi", "Chuỗi cửa hàng"],
    category: "DOMAIN",
    targetRoles: ["BUSINESS_ANALYST", "DATA_ANALYST"],
    description: "Nghiệp vụ bán lẻ đa kênh, lòng trung thành khách hàng, POS và vận hành đơn hàng",
    defaultWeight: 7,
  },
  {
    name: "Supply Chain & Logistics",
    aliases: ["Supply Chain", "Logistics", "Kho bãi", "Vận tải", "WMS", "TMS", "Khu công nghiệp", "Sản xuất", "Smart Factory"],
    category: "DOMAIN",
    targetRoles: ["BUSINESS_ANALYST", "DATA_ANALYST"],
    description: "Nghiệp vụ chuỗi cung ứng, kho vận và nhà máy sản xuất (Thế mạnh Đồng Nai và HCM)",
    defaultWeight: 6,
  },
  {
    name: "Fintech & Banking",
    aliases: ["Fintech", "Banking", "Ngân hàng", "Tài chính", "Thanh toán", "Core Banking", "Lending"],
    category: "DOMAIN",
    targetRoles: ["BUSINESS_ANALYST", "DATA_ANALYST"],
    description: "Nghiệp vụ ngân hàng số, cổng thanh toán và quản lý rủi ro tài chính",
    defaultWeight: 6,
  },
];

export const ALL_TAXONOMY_SKILLS = [
  ...BA_CORE_SKILLS,
  ...DA_CORE_SKILLS,
  ...COMMON_TOOLS,
  ...DOMAIN_KNOWLEDGE,
];
