import { BadRequestException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { EvolutionUrlValidator } from "./evolution-url.validator";

// Mock the resolver so the SSRF suite is deterministic. Returning a private IP
// for "private-target.example.com" exercises the post-resolution check without
// depending on real DNS, which would be flaky in CI.
jest.mock("node:dns/promises", () => {
  const actual = jest.requireActual("node:dns/promises") as Record<string, unknown>;
  return {
    ...actual,
    lookup: jest.fn(async () => {
      return [{ address: "198.51.100.10", family: 4 }];
    }),
  };
});

// Pull a reference to the mocked lookup so individual specs can override it.
import * as dnsPromisesMock from "node:dns/promises";
const lookupMock = dnsPromisesMock.lookup as unknown as jest.Mock;

function buildCfg(env: Record<string, string | undefined>): ConfigService {
  return { get: (key: string) => env[key] } as unknown as ConfigService;
}

describe("EvolutionUrlValidator", () => {
  const prodCfg = buildCfg({ NODE_ENV: "production" });
  const devCfg = buildCfg({ NODE_ENV: "development" });
  const devAllowCfg = buildCfg({ NODE_ENV: "development", ALLOW_PRIVATE_HOSTS: "true" });

  beforeEach(() => {
    lookupMock.mockClear();
  });

  describe("validate (production)", () => {
    it("accepts an https public URL", async () => {
      const v = new EvolutionUrlValidator(prodCfg);
      const res = await v.validate({
        newBaseUrl: "https://evolution-public.example.com",
      });
      expect(res.origin).toBe("https://evolution-public.example.com");
      expect(res.sameOriginAsBefore).toBe(false);
    });

    it("rejects http in production", async () => {
      const v = new EvolutionUrlValidator(prodCfg);
      await expect(
        v.validate({ newBaseUrl: "http://evolution-public.example.com" }),
      ).rejects.toThrow(/HTTPS/);
    });

    it("rejects a loopback hostname in production", async () => {
      const v = new EvolutionUrlValidator(prodCfg);
      await expect(
        v.validate({ newBaseUrl: "https://localhost:8090" }),
      ).rejects.toThrow(/reserved|loopback/);
    });

    it("rejects a hostname that resolves to a private IP in production", async () => {
      lookupMock.mockResolvedValueOnce([{ address: "10.0.0.5", family: 4 }]);
      const v = new EvolutionUrlValidator(prodCfg);
      await expect(
        v.validate({ newBaseUrl: "https://private-target.example.com" }),
      ).rejects.toThrow(/reserved address/);
    });

    it("rejects a 10.x.x.x literal in production", async () => {
      const v = new EvolutionUrlValidator(prodCfg);
      await expect(
        v.validate({ newBaseUrl: "https://10.0.0.5:8090" }),
      ).rejects.toThrow(/reserved|loopback/);
    });

    it("rejects a 192.168.x.x literal in production", async () => {
      const v = new EvolutionUrlValidator(prodCfg);
      await expect(
        v.validate({ newBaseUrl: "https://192.168.1.10" }),
      ).rejects.toThrow(/reserved|loopback/);
    });

    it("rejects embedded credentials in the URL", async () => {
      const v = new EvolutionUrlValidator(prodCfg);
      await expect(
        v.validate({ newBaseUrl: "https://user:pass@evolution-public.example.com" }),
      ).rejects.toThrow(/embedded credentials/);
    });

    it("rejects empty / malformed URLs", async () => {
      const v = new EvolutionUrlValidator(prodCfg);
      await expect(v.validate({ newBaseUrl: "" })).rejects.toThrow(BadRequestException);
      await expect(v.validate({ newBaseUrl: "not a url" })).rejects.toThrow(BadRequestException);
    });
  });

  describe("validate (development)", () => {
    it("allows http loopback when ALLOW_PRIVATE_HOSTS is set", async () => {
      const v = new EvolutionUrlValidator(devAllowCfg);
      const res = await v.validate({ newBaseUrl: "http://localhost:8090" });
      expect(res.origin).toBe("http://localhost:8090");
    });

    it("still requires a syntactically valid URL in dev", async () => {
      const v = new EvolutionUrlValidator(devCfg);
      await expect(v.validate({ newBaseUrl: "ftp://example.com" })).rejects.toThrow(/http/);
    });
  });

  describe("sameOriginAsBefore", () => {
    it("returns true when the origin is unchanged", async () => {
      const v = new EvolutionUrlValidator(prodCfg);
      const res = await v.validate({
        newBaseUrl: "https://evolution-public.example.com",
        previousBaseUrl: "https://evolution-public.example.com",
      });
      expect(res.sameOriginAsBefore).toBe(true);
    });

    it("returns false when the origin is changed", async () => {
      const v = new EvolutionUrlValidator(prodCfg);
      const res = await v.validate({
        newBaseUrl: "https://evolution-public.example.com",
        previousBaseUrl: "https://evolution.attacker.example",
      });
      expect(res.sameOriginAsBefore).toBe(false);
    });

    it("returns false when the previous URL was malformed", async () => {
      const v = new EvolutionUrlValidator(prodCfg);
      const res = await v.validate({
        newBaseUrl: "https://evolution-public.example.com",
        previousBaseUrl: "garbage",
      });
      expect(res.sameOriginAsBefore).toBe(false);
    });

    it("flags a port change as a different origin", async () => {
      const v = new EvolutionUrlValidator(prodCfg);
      const res = await v.validate({
        newBaseUrl: "https://evolution-public.example.com:8443",
        previousBaseUrl: "https://evolution-public.example.com",
      });
      expect(res.sameOriginAsBefore).toBe(false);
    });
  });
});
