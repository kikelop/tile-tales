import { describe, it, expect, vi, beforeEach } from "vitest";
import { reverseGeocode, getCachedReverse, searchPlaces } from "./geo";

const nominatimReverse = (city: string, country: string) =>
  Promise.resolve(
    new Response(
      JSON.stringify({
        address: { city, country },
        display_name: `${city}, ${country}`,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  );

describe("reverseGeocode", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns a 'city, country' label and caches it in localStorage", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      nominatimReverse("Lisboa", "Portugal")
    );
    const label = await reverseGeocode(38.7223, -9.1393);
    expect(label).toBe("Lisboa, Portugal");
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Hit again — should come from cache, no extra fetch.
    const again = await reverseGeocode(38.7223, -9.1393);
    expect(again).toBe("Lisboa, Portugal");
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    expect(getCachedReverse(38.7223, -9.1393)).toBe("Lisboa, Portugal");
  });

  it("dedupes in-flight calls for the same coords", async () => {
    let resolveFetch: ((r: Response) => void) | null = null;
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(
      () => new Promise<Response>((resolve) => { resolveFetch = resolve; })
    );
    const p1 = reverseGeocode(41.3874, 2.1686);
    const p2 = reverseGeocode(41.3874, 2.1686);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    resolveFetch?.(
      new Response(
        JSON.stringify({ address: { city: "Barcelona", country: "España" } }),
        { status: 200 }
      )
    );
    const [a, b] = await Promise.all([p1, p2]);
    expect(a).toBe("Barcelona, España");
    expect(b).toBe("Barcelona, España");
  });

  it("returns null when the response has no usable address", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({}), { status: 200 }))
    );
    const label = await reverseGeocode(0, 0);
    expect(label).toBeNull();
  });
});

describe("searchPlaces", () => {
  it("returns an empty array when the query is too short", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    expect(await searchPlaces("")).toEqual([]);
    expect(await searchPlaces("a")).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("maps Nominatim results to PlaceResult shape", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify([
            { display_name: "Madrid, Spain", lat: "40.4168", lon: "-3.7038" },
            { display_name: "Bad item", lat: "abc", lon: "def" },
          ]),
          { status: 200 }
        )
      )
    );
    const results = await searchPlaces("madrid");
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      label: "Madrid, Spain",
      lat: 40.4168,
      lng: -3.7038,
    });
  });
});
