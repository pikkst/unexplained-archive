import React, { useMemo } from 'react';
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps';

const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// Country name mapping (analytics data might use different names)
const countryNameMap: { [key: string]: string } = {
  'USA': 'United States of America',
  'US': 'United States of America',
  'United States': 'United States of America',
  'UK': 'United Kingdom',
  'UAE': 'United Arab Emirates',
  'Russia': 'Russian Federation',
  'South Korea': 'Korea',
  'North Korea': 'Dem. Rep. Korea',
  'Tanzania': 'United Rep. of Tanzania',
  'Serbia': 'Republic of Serbia',
  'Czech Republic': 'Czechia',
  'Macedonia': 'North Macedonia',
  'Bosnia': 'Bosnia and Herzegovina',
  'Laos': 'Lao PDR',
  'Vietnam': 'Viet Nam',
  'Syria': 'Syrian Arab Republic',
  'Bolivia': 'Bolivia (Plurinational State of)',
  'Venezuela': 'Venezuela (Bolivarian Republic of)',
  'Iran': 'Iran (Islamic Republic of)',
  'Moldova': 'Republic of Moldova',
  'Palestine': 'State of Palestine',
  'Ivory Coast': "Côte d'Ivoire",
  'Congo': 'Democratic Republic of the Congo',
};

interface WorldMapVisualizationProps {
  countryData: { country: string; visits: number }[];
  autoRefresh?: boolean;
}

const WorldMapVisualization: React.FC<WorldMapVisualizationProps> = ({ countryData, autoRefresh = true }) => {
  // Calculate color intensity based on visits
  const maxVisits = useMemo(() => {
    return Math.max(...countryData.map(c => c.visits), 1);
  }, [countryData]);

  // Create a map for quick lookup
  const countryVisitsMap = useMemo(() => {
    const map = new Map<string, number>();
    countryData.forEach(({ country, visits }) => {
      const normalizedName = countryNameMap[country] || country;
      map.set(normalizedName, visits);
      // Also set original name as fallback
      map.set(country, visits);
    });
    return map;
  }, [countryData]);

  // Get color based on visit count
  const getCountryColor = (geoName: string): string => {
    const visits = countryVisitsMap.get(geoName) || 0;
    
    if (visits === 0) {
      return '#1a1f3a'; // Dark background for countries with no visits
    }
    
    // Calculate intensity (0-1)
    const intensity = Math.min(visits / maxVisits, 1);
    
    // Color gradient from dark blue to bright cyan
    if (intensity < 0.2) {
      return '#2d3a5f'; // Very light activity
    } else if (intensity < 0.4) {
      return '#3d4a7f'; // Light activity
    } else if (intensity < 0.6) {
      return '#4d5a9f'; // Medium activity
    } else if (intensity < 0.8) {
      return '#5d6abf'; // High activity
    } else {
      return '#00d9ff'; // Very high activity (mystery-400)
    }
  };

  // Get tooltip text
  const getTooltipText = (geoName: string): string => {
    const visits = countryVisitsMap.get(geoName) || 0;
    if (visits === 0) return `${geoName}: No visits`;
    return `${geoName}: ${visits} visit${visits !== 1 ? 's' : ''}`;
  };

  return (
    <div className="relative">
      {autoRefresh && (
        <div className="absolute top-2 right-2 z-10">
          <div className="flex items-center gap-2 bg-mystery-900 px-3 py-1 rounded-full border border-mystery-600">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-xs text-gray-400">Live</span>
          </div>
        </div>
      )}
      
      <div className="bg-mystery-900 rounded-lg border border-mystery-700 overflow-hidden">
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{
            scale: 120,
            center: [0, 20]
          }}
          style={{
            width: '100%',
            height: 'auto'
          }}
        >
          <ZoomableGroup>
            <Geographies geography={geoUrl}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const geoName = geo.properties.name;
                  const visits = countryVisitsMap.get(geoName) || 0;
                  
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={getCountryColor(geoName)}
                      stroke="#0f1629"
                      strokeWidth={0.5}
                      style={{
                        default: {
                          outline: 'none',
                        },
                        hover: {
                          fill: visits > 0 ? '#00ffff' : '#2d3a5f',
                          outline: 'none',
                          cursor: 'pointer',
                        },
                        pressed: {
                          outline: 'none',
                        },
                      }}
                    >
                      <title>{getTooltipText(geoName)}</title>
                    </Geography>
                  );
                })
              }
            </Geographies>
          </ZoomableGroup>
        </ComposableMap>
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center justify-center gap-6">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: '#1a1f3a' }}></div>
          <span className="text-xs text-gray-400">No visits</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: '#2d3a5f' }}></div>
          <span className="text-xs text-gray-400">1-20%</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: '#3d4a7f' }}></div>
          <span className="text-xs text-gray-400">21-40%</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: '#4d5a9f' }}></div>
          <span className="text-xs text-gray-400">41-60%</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: '#5d6abf' }}></div>
          <span className="text-xs text-gray-400">61-80%</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: '#00d9ff' }}></div>
          <span className="text-xs text-gray-400">81-100%</span>
        </div>
      </div>

      {/* Top Countries List */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {countryData.slice(0, 8).map((country, idx) => {
          const percentage = (country.visits / maxVisits) * 100;
          return (
            <div key={idx} className="bg-mystery-900 border border-mystery-700 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className={`inline-block w-3 h-3 rounded-full ${
                  idx === 0 ? 'bg-green-500' :
                  idx === 1 ? 'bg-blue-500' :
                  idx === 2 ? 'bg-purple-500' :
                  'bg-mystery-400'
                }`}></span>
                <span className="text-lg font-bold text-white">{country.visits}</span>
              </div>
              <div className="text-sm text-gray-300 font-medium truncate">{country.country}</div>
              <div className="mt-2 w-full h-1.5 bg-mystery-800 rounded-full overflow-hidden">
                <div 
                  className={`h-full ${
                    idx === 0 ? 'bg-green-500' :
                    idx === 1 ? 'bg-blue-500' :
                    idx === 2 ? 'bg-purple-500' :
                    'bg-mystery-400'
                  }`}
                  style={{ width: `${percentage}%` }}
                ></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WorldMapVisualization;
