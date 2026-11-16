import { describe, expect, it } from "vitest";
import { altFromFileName } from "./upload-image";

describe("altFromFileName", () => {
  it("turns a file name into a readable description", () => {
    expect(altFromFileName("coxs-bazar_sunset.jpg")).toBe("Coxs bazar sunset");
    expect(altFromFileName("hotel.room.view.PNG")).toBe("Hotel room view");
  });

  it("drops camera numbering and falls back to 'Photo'", () => {
    expect(altFromFileName("IMG_20261116_1234.jpg")).toBe("Photo");
    expect(altFromFileName("DSC 0042 beach.jpeg")).toBe("Beach");
    expect(altFromFileName("a.heic")).toBe("Photo");
  });
});
