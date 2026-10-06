"use client";

import { Minus, Plus, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState, type WheelEvent } from "react";

type RegionCount = { region: string; count: number };

type Geometry =
  | { type: "Polygon"; coordinates: number[][][] }
  | { type: "MultiPolygon"; coordinates: number[][][][] }
  | null;

type MapFeature = {
  type: "Feature";
  properties: {
    name?: string;
    center?: [number, number];
    centroid?: [number, number];
  };
  geometry: Geometry;
};

type MapDocument = { type: "FeatureCollection"; features: MapFeature[] };

type PreparedFeature = MapFeature & {
  path: string;
  point: [number, number];
  region: string;
};

type ChinaMapProps = {
  regionDistribution: RegionCount[];
  selectedProvince: string;
  onSelectProvince: (province: string) => void;
};

const MAP_WIDTH = 1000;
const MAP_HEIGHT = 620;

export function ChinaMap({
  regionDistribution,
  selectedProvince,
  onSelectProvince,
}: ChinaMapProps) {
  const [document, setDocument] = useState<MapDocument | null>(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    let active = true;
    fetch("/china-map.json", { cache: "force-cache" })
      .then((response) => {
        if (!response.ok) throw new Error("地图数据加载失败");
        return response.json() as Promise<MapDocument>;
      })
      .then((nextDocument) => {
        if (active) setDocument(nextDocument);
      })
      .catch(() => {
        if (active) setDocument(null);
      });
    return () => {
      active = false;
    };
  }, []);

  const preparedFeatures = useMemo(
    () => (document ? prepareFeatures(document.features) : []),
    [document],
  );
  const countMap = useMemo(
    () => new Map(regionDistribution.map((item) => [normalizeRegion(item.region), item.count])),
    [regionDistribution],
  );
  const maxCount = Math.max(...regionDistribution.map((item) => item.count), 1);

  function updateZoom(next: number) {
    setZoom(Math.min(2.4, Math.max(1, Number(next.toFixed(2)))));
  }

  function handleWheel(event: WheelEvent<SVGSVGElement>) {
    event.preventDefault();
    updateZoom(zoom + (event.deltaY < 0 ? 0.12 : -0.12));
  }

  return (
    <div className="map-stage">
      <div className="map-stage__toolbar" aria-label="地图缩放控制">
        <button type="button" onClick={() => updateZoom(zoom + 0.2)} aria-label="放大地图">
          <Plus size={16} />
        </button>
        <span>{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => updateZoom(zoom - 0.2)} aria-label="缩小地图">
          <Minus size={16} />
        </button>
        <button type="button" onClick={() => updateZoom(1)} aria-label="重置地图">
          <RotateCcw size={15} />
        </button>
      </div>
      <svg
        className="china-map"
        viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
        role="img"
        aria-label="全国招生单位地区分布地图"
        onWheel={handleWheel}
      >
        <defs>
          <linearGradient id="mapFill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0d507c" />
            <stop offset="55%" stopColor="#0c77ad" />
            <stop offset="100%" stopColor="#123e83" />
          </linearGradient>
          <linearGradient id="mapSelected" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#13d8e7" />
            <stop offset="100%" stopColor="#3a71ff" />
          </linearGradient>
          <filter id="mapGlow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="softGlow" x="-120%" y="-120%" width="340%" height="340%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g
          className="map-content"
          transform={`translate(${MAP_WIDTH / 2} ${MAP_HEIGHT / 2}) scale(${zoom}) translate(${-MAP_WIDTH / 2} ${-MAP_HEIGHT / 2})`}
        >
          {preparedFeatures.map((feature) => {
            const count = countMap.get(feature.region) ?? 0;
            const selected = feature.region === normalizeRegion(selectedProvince);
            return (
              <path
                key={feature.properties.name ?? feature.region}
                d={feature.path}
                className={`map-province${selected ? " is-selected" : ""}`}
                style={{
                  fill: selected ? "url(#mapSelected)" : "url(#mapFill)",
                  opacity: 0.7 + Math.min(0.25, count / maxCount / 4),
                }}
                onClick={() => onSelectProvince(feature.region)}
                aria-label={`${feature.region}，${count} 个招生单位`}
              />
            );
          })}
          {preparedFeatures.map((feature, index) => {
            const count = countMap.get(feature.region) ?? 0;
            if (!count) return null;
            const selected = feature.region === normalizeRegion(selectedProvince);
            const radius = 3.5 + Math.min(8, (count / maxCount) * 8);
            return (
              <g
                key={`${feature.region}-dot`}
                className={`map-dot${selected ? " is-selected" : ""}`}
                transform={`translate(${feature.point[0]} ${feature.point[1]})`}
                onClick={() => onSelectProvince(feature.region)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") onSelectProvince(feature.region);
                }}
              >
                <circle className="map-dot__wave" r={radius * 2.4} style={{ animationDelay: `${(index % 8) * 180}ms` }} />
                <circle className="map-dot__halo" r={radius * 1.5} />
                <circle className="map-dot__core" r={radius} />
                <text x={radius + 8} y={4} className="map-dot__label">
                  {feature.region}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
      {!document && <div className="map-stage__loading">地图载入中…</div>}
      <div className="map-stage__legend">
        <span><i className="legend-dot legend-dot--large" /> 100+</span>
        <span><i className="legend-dot legend-dot--medium" /> 50–99</span>
        <span><i className="legend-dot legend-dot--small" /> 1–49</span>
        <small>点击省份查看院校</small>
      </div>
    </div>
  );
}

function prepareFeatures(features: MapFeature[]): PreparedFeature[] {
  const bounds = getBounds(features);
  const project = (coordinate: number[]): [number, number] => {
    const [longitude, latitude] = coordinate;
    const width = bounds.maxLongitude - bounds.minLongitude || 1;
    const height = bounds.maxLatitude - bounds.minLatitude || 1;
    return [
      52 + ((longitude - bounds.minLongitude) / width) * (MAP_WIDTH - 104),
      42 + ((bounds.maxLatitude - latitude) / height) * (MAP_HEIGHT - 84),
    ];
  };

  return features.flatMap((feature) => {
    if (!feature.geometry) return [];
    const region = normalizeRegion(feature.properties.name ?? "未标注");
    const point = feature.properties.center ?? feature.properties.centroid ?? getGeometryCenter(feature.geometry);
    return [{
      ...feature,
      region,
      path: geometryToPath(feature.geometry, project),
      point: project(point),
    }];
  });
}

function getBounds(features: MapFeature[]) {
  const values: number[][] = [];
  features.forEach((feature) => collectCoordinates(feature.geometry, values));
  const longitudes = values.map((coordinate) => coordinate[0]);
  const latitudes = values.map((coordinate) => coordinate[1]);
  return {
    minLongitude: Math.min(...longitudes),
    maxLongitude: Math.max(...longitudes),
    minLatitude: Math.min(...latitudes),
    maxLatitude: Math.max(...latitudes),
  };
}

function collectCoordinates(geometry: Geometry, values: number[][]) {
  if (!geometry) return;
  const visit = (value: unknown) => {
    if (!Array.isArray(value)) return;
    if (typeof value[0] === "number" && typeof value[1] === "number") {
      values.push(value as number[]);
      return;
    }
    value.forEach(visit);
  };
  visit(geometry.coordinates);
}

function geometryToPath(geometry: Exclude<Geometry, null>, project: (coordinate: number[]) => [number, number]) {
  if (geometry.type === "Polygon") {
    return geometry.coordinates.map((ring) => ringToPath(ring, project)).join(" ");
  }
  return geometry.coordinates
    .flatMap((polygon) => polygon.map((ring) => ringToPath(ring, project)))
    .join(" ");
}

function ringToPath(ring: number[][], project: (coordinate: number[]) => [number, number]) {
  return `${ring.map((coordinate, index) => {
    const [x, y] = project(coordinate);
    return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(" ")} Z`;
}

function getGeometryCenter(geometry: Exclude<Geometry, null>): [number, number] {
  const coordinates: number[][] = [];
  collectCoordinates(geometry, coordinates);
  const longitude = coordinates.reduce((sum, item) => sum + item[0], 0) / coordinates.length;
  const latitude = coordinates.reduce((sum, item) => sum + item[1], 0) / coordinates.length;
  return [longitude, latitude];
}

export function normalizeRegion(value: string) {
  return value
    .replace(/特别行政区|维吾尔自治区|壮族自治区|回族自治区|自治区|省|市/g, "")
    .replace("黑龙江", "黑龙江")
    .trim();
}
