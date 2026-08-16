/**
 * Tiện ích phân giải và chuẩn hóa Logo thương hiệu doanh nghiệp
 * Áp dụng cho các doanh nghiệp tuyển dụng tại Việt Nam (TP.HCM, Đồng Nai)
 */

export interface CompanyBrandInfo {
  domain: string;
  officialLogoUrl?: string;
  primaryColor: string;
}

export const KNOWN_COMPANY_BRANDS: Record<string, CompanyBrandInfo> = {
  vnpay: {
    domain: "vnpay.vn",
    officialLogoUrl: "https://vnpay.vn/assets/images/logo.svg",
    primaryColor: "#005BAA",
  },
  shopee: {
    domain: "shopee.vn",
    officialLogoUrl: "https://deo.shopeemobile.com/shopee/shopee-seller-live-sg/rootpages/static/modules/mall/image/logo.png",
    primaryColor: "#EE4D2D",
  },
  cj: {
    domain: "cjlogistics.com",
    officialLogoUrl: "https://www.cjlogistics.com/static/images/common/logo.png",
    primaryColor: "#E31E24",
  },
  "cj logistics": {
    domain: "cjlogistics.com",
    officialLogoUrl: "https://www.cjlogistics.com/static/images/common/logo.png",
    primaryColor: "#E31E24",
  },
  bosch: {
    domain: "bosch.com",
    officialLogoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/16/Bosch-Logo.svg/512px-Bosch-Logo.svg.png",
    primaryColor: "#EA0016",
  },
  fpt: {
    domain: "fpt.com",
    officialLogoUrl: "https://fpt.com/themes/fpt/assets/images/logo.svg",
    primaryColor: "#F37021",
  },
  "fpt software": {
    domain: "fptsoftware.com",
    officialLogoUrl: "https://fptsoftware.com/Content/images/fpt-software-logo.svg",
    primaryColor: "#F37021",
  },
  momo: {
    domain: "momo.vn",
    officialLogoUrl: "https://upload.wikimedia.org/wikipedia/vi/f/fe/MoMo_Logo.png",
    primaryColor: "#A50064",
  },
  nestle: {
    domain: "nestle.com.vn",
    officialLogoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/Nestl%C3%A9_textlogo.svg/512px-Nestl%C3%A9_textlogo.svg.png",
    primaryColor: "#004880",
  },
  "nestlé": {
    domain: "nestle.com.vn",
    officialLogoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/Nestl%C3%A9_textlogo.svg/512px-Nestl%C3%A9_textlogo.svg.png",
    primaryColor: "#004880",
  },
  masan: {
    domain: "masangroup.com",
    officialLogoUrl: "https://masangroup.com/themes/masan/images/logo.png",
    primaryColor: "#0085CA",
  },
  techcombank: {
    domain: "techcombank.com",
    officialLogoUrl: "https://techcombank.com/content/dam/techcombank-site/images/logo/logo.svg",
    primaryColor: "#E31937",
  },
  vpbank: {
    domain: "vpbank.com.vn",
    officialLogoUrl: "https://www.vpbank.com.vn/assets/images/logo.svg",
    primaryColor: "#00A859",
  },
  vng: {
    domain: "vng.com.vn",
    officialLogoUrl: "https://vng.com.vn/assets/images/logo.svg",
    primaryColor: "#F37021",
  },
  viettel: {
    domain: "viettel.vn",
    officialLogoUrl: "https://viettel.vn/assets/images/logo.svg",
    primaryColor: "#EE0033",
  },
  tiki: {
    domain: "tiki.vn",
    officialLogoUrl: "https://salt.tikicdn.com/ts/upload/e8/aa/f6/4eed26a40a875d6dd8b6b2781498b31a.png",
    primaryColor: "#1A94FF",
  },
  grab: {
    domain: "grab.com",
    officialLogoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Grab_Logo.svg/512px-Grab_Logo.svg.png",
    primaryColor: "#00B14F",
  },
  intel: {
    domain: "intel.com",
    officialLogoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7d/Intel_logo_%282020%29.svg/512px-Intel_logo_%282020%29.svg.png",
    primaryColor: "#0068B5",
  },
  lego: {
    domain: "lego.com",
    officialLogoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/24/LEGO_logo.svg/512px-LEGO_logo.svg.png",
    primaryColor: "#E3000B",
  },
  unilever: {
    domain: "unilever.com",
    officialLogoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Unilever.svg/512px-Unilever.svg.png",
    primaryColor: "#1F36C7",
  },
};

/**
 * Trích xuất domain hoặc tìm kiếm cấu hình thương hiệu của công ty (hỗ trợ registry mở rộng)
 */
export function resolveCompanyBrand(
  companyName: string,
  customRegistry?: Record<string, CompanyBrandInfo>
): CompanyBrandInfo | null {
  if (!companyName) return null;
  const nameClean = companyName.toLowerCase().trim();
  const registry = { ...KNOWN_COMPANY_BRANDS, ...customRegistry };

  // Tìm trong danh mục các thương hiệu
  for (const [key, brand] of Object.entries(registry)) {
    if (nameClean.includes(key)) {
      return brand;
    }
  }

  // Tự động tạo domain giả định từ tên công ty nếu là tên quốc tế
  const simplified = nameClean
    .replace(/\b(vietnam|việt nam|solution|solutions|corp|corporation|group|hub|plant|strategic|digital|lab|operations|center)\b/g, "")
    .trim()
    .replace(/[^a-z0-9]/g, "");

  if (simplified.length >= 3) {
    return {
      domain: `${simplified}.com`,
      primaryColor: "#4F46E5",
    };
  }

  return null;
}

/**
 * Lấy đường dẫn Logo thương hiệu tối ưu cho công ty (hỗ trợ tùy biến CDN)
 */
export function getCompanyLogoUrl(
  companyName: string,
  fallbackUrl?: string,
  options?: {
    customRegistry?: Record<string, CompanyBrandInfo>;
    faviconCdnTemplate?: (domain: string) => string;
  }
): string {
  if (fallbackUrl && !fallbackUrl.includes("unsplash.com")) {
    return fallbackUrl;
  }

  const brand = resolveCompanyBrand(companyName, options?.customRegistry);
  if (brand?.officialLogoUrl) {
    return brand.officialLogoUrl;
  }

  if (brand?.domain) {
    if (options?.faviconCdnTemplate) {
      return options.faviconCdnTemplate(brand.domain);
    }
    // Sử dụng Google S2 Favicon API độ phân giải 128x128 làm CDN ổn định
    return `https://www.google.com/s2/favicons?domain=${brand.domain}&sz=128`;
  }

  // Nếu không nhận diện được domain, tạo avatar chữ cái đầu với màu sắc chuyên nghiệp
  const encodedName = encodeURIComponent(companyName || "Company");
  return `https://ui-avatars.com/api/?name=${encodedName}&background=0F172A&color=FFFFFF&size=128&bold=true`;
}
