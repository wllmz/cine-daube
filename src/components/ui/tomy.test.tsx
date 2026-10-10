import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Tomy } from "./tomy";

describe("Tomy", () => {
  it("renders an accessible image at the requested size", () => {
    render(<Tomy size={64} />);
    const svg = screen.getByRole("img", { name: /tomy/i });
    expect(svg.getAttribute("width")).toBe("64");
  });

  it("shows the tongue only when disgusted", () => {
    const { container, rerender } = render(<Tomy mood="content" />);
    expect(container.querySelector('path[fill="#FF9DAF"]')).toBeNull();

    rerender(<Tomy mood="degoute" />);
    expect(container.querySelector('path[fill="#FF9DAF"]')).not.toBeNull();
  });
});
