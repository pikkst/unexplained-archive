
import React, { useEffect, useRef, useState } from 'react';
import { Layers, Eye, EyeOff, Maximize, Minimize } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface CaseData {
  id: string;
  title: string;
  category: string;
  status: string;
  latitude: number;
  longitude: number;
  media_urls: string[];
  ai_generated: boolean;
}

interface CaseMapProps {
  onCaseClick?: (caseId: string) => void;
  isPickerMode?: boolean;
  onLocationPick?: (lat: number, lng: number) => void;
}

// Helper to get color by category
const getCategoryColor = (category: string) => {
  switch (category.toLowerCase()) {
    case 'ufo': return '#6366f1'; // Indigo
    case 'cryptid': return '#16a34a'; // Green
    case 'paranormal': return '#9333ea'; // Purple
    case 'supernatural': return '#dc2626'; // Red
    default: return '#64748b'; // Slate
  }
};

const CATEGORIES = ['ufo', 'cryptid', 'paranormal', 'supernatural', 'other'];

export const CaseMap: React.FC<CaseMapProps> = ({ 
  onCaseClick, 
  isPickerMode = false,
  onLocationPick
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapWrapperRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [zoomLevel, setZoomLevel] = useState(3);
  const [tempMarker, setTempMarker] = useState<any>(null);
  const [cases, setCases] = useState<CaseData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Filter State
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set(CATEGORIES));
  const [isLegendOpen, setIsLegendOpen] = useState(true);

  // Fetch cases from Supabase
  useEffect(() => {
    fetchCases();
  }, []);

  const fetchCases = async () => {
    try {
      const { data, error } = await supabase
        .from('cases')
        .select('id, title, category, status, latitude, longitude, media_urls, ai_generated')
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);

      if (error) throw error;
      setCases(data || []);
    } catch (error) {
      console.error('Error fetching cases for map:', error);
    } finally {
      setLoading(false);
    }
  };

  // Toggle Category
  const toggleCategory = (cat: string) => {
    const newSet = new Set(selectedCategories);
    if (newSet.has(cat)) {
      newSet.delete(cat);
    } else {
      newSet.add(cat);
    }
    setSelectedCategories(newSet);
  };

  const visibleCases = cases.filter(c => selectedCategories.has(c.category.toLowerCase()));

  // Handle Fullscreen Toggle
  const toggleFullscreen = async () => {
    if (!mapWrapperRef.current) return;

    try {
      if (!document.fullscreenElement) {
        await mapWrapperRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.error('Error toggling fullscreen:', error);
    }
  };

  // Listen for fullscreen changes (e.g., ESC key)
  useEffect(() => {
    // Delay for map to properly recalculate its size after fullscreen transition
    const MAP_RESIZE_DELAY_MS = 100;
    
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      // Invalidate map size to ensure proper rendering after fullscreen changes
      if (mapInstanceRef.current) {
        setTimeout(() => {
          mapInstanceRef.current.invalidateSize();
        }, MAP_RESIZE_DELAY_MS);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Initialize map once after loading is complete
  useEffect(() => {
    if (loading) return; // Wait until cases are loaded
    
    // Wait for Leaflet to load
    const initMap = () => {
      if (!(window as any).L || !mapContainerRef.current) return;
      const L = (window as any).L;

      // Initialize Map if not already done
      if (!mapInstanceRef.current) {
        try {
          mapInstanceRef.current = L.map(mapContainerRef.current, {
            zoomControl: false
          }).setView([20, 0], 3);
          
          L.control.zoom({
            position: 'topright'
          }).addTo(mapInstanceRef.current);

          // Dark Matter Tile Layer (Free CartoDB)
          L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 19
          }).addTo(mapInstanceRef.current);

          // Handle Zoom Events
          mapInstanceRef.current.on('zoomend', () => {
            setZoomLevel(mapInstanceRef.current.getZoom());
          });

          // Handle Click for Picker Mode
          if (isPickerMode) {
            mapInstanceRef.current.on('click', (e: any) => {
              if (onLocationPick) {
                 onLocationPick(e.latlng.lat, e.latlng.lng);
                 
                 // Remove old temp marker
                 if (tempMarker) mapInstanceRef.current.removeLayer(tempMarker);
                 
                 // Add new temp marker
                 const newMarker = L.marker([e.latlng.lat, e.latlng.lng]).addTo(mapInstanceRef.current);
                 setTempMarker(newMarker);
              }
            });
          }
        } catch (error) {
          console.error('Error initializing map:', error);
        }
      }
    };

    // Check if Leaflet is already loaded
    let checkInterval: NodeJS.Timeout | null = null;
    
    if ((window as any).L) {
      initMap();
    } else {
      // Wait for Leaflet to load
      checkInterval = setInterval(() => {
        if ((window as any).L) {
          clearInterval(checkInterval!);
          initMap();
        }
      }, 100);
    }

    // Cleanup only on unmount
    return () => {
      if (checkInterval) clearInterval(checkInterval);
    };
  }, [loading, isPickerMode]); // Re-run when loading changes

  // Cleanup map on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
        } catch (error) {
          console.error('Error removing map:', error);
        }
      }
    };
  }, []);

  // Handle Markers & Semantic Zoom
  useEffect(() => {
    if (!mapInstanceRef.current || isPickerMode) return;
    const L = (window as any).L;
    
    // Clear existing markers
    markersRef.current.forEach(m => mapInstanceRef.current.removeLayer(m));
    markersRef.current = [];

    visibleCases.forEach(c => {
      if (!c.latitude || !c.longitude) return;

      let iconHtml = '';
      let iconSize: [number, number] = [20, 20];
      let anchor: [number, number] = [10, 10];
      let className = '';

      const color = getCategoryColor(c.category);
      const imageUrl = c.media_urls?.[0] || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.title)}&background=1e293b&color=fff`;

      // --- Semantic Zoom Logic ---
      
      // Zoom Level 1-4: Dots
      if (zoomLevel < 5) {
        iconSize = [8, 8];
        anchor = [4, 4];
        iconHtml = `<div style="width: 100%; height: 100%; background-color: ${color}; border-radius: 50%; box-shadow: 0 0 5px ${color};"></div>`;
      } 
      // Zoom Level 5-11: Category Icons
      else if (zoomLevel >= 5 && zoomLevel <= 11) {
        iconSize = [30, 30];
        anchor = [15, 15];
        iconHtml = `
          <div style="
            width: 100%; 
            height: 100%; 
            background-color: #1e293b; 
            border: 2px solid ${color}; 
            border-radius: 50%; 
            display: flex; 
            align-items: center; 
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 10px;
          ">
            ${c.category.charAt(0).toUpperCase()}
          </div>
        `;
      } 
      // Zoom Level 12+: Detailed Cards
      else {
        iconSize = [160, 60];
        anchor = [80, 60]; // Anchored bottom center
        className = 'leaflet-custom-card';
        iconHtml = `
          <div style="
            background-color: #0f172a;
            border: 1px solid ${color};
            border-radius: 8px;
            overflow: hidden;
            display: flex;
            align-items: center;
            box-shadow: 0 4px 6px rgba(0,0,0,0.5);
          ">
            <img src="${imageUrl}" style="width: 50px; height: 50px; object-fit: cover;" />
            <div style="padding: 5px; color: white; font-family: sans-serif; overflow: hidden;">
              <div style="font-size: 10px; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 90px;">${c.title}</div>
              <div style="font-size: 8px; color: #94a3b8;">${c.status}</div>
            </div>
            <div style="position: absolute; bottom: -5px; left: 50%; transform: translateX(-50%); width: 0; height: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; border-top: 5px solid ${color};"></div>
          </div>
        `;
      }

      const icon = L.divIcon({
        className: className,
        html: iconHtml,
        iconSize: iconSize,
        iconAnchor: anchor,
      });

      const marker = L.marker([c.latitude, c.longitude], { icon })
        .addTo(mapInstanceRef.current)
        .on('click', () => {
          if (onCaseClick) onCaseClick(c.id);
        });

      // Add a popup for intermediate zoom levels
      if (zoomLevel < 12) {
          marker.bindPopup(`
            <div class="font-sans">
                <strong class="block text-sm mb-1">${c.title}</strong>
                <span class="text-xs px-2 py-0.5 rounded bg-gray-700 text-white">${c.status}</span>
            </div>
          `);
      }

      markersRef.current.push(marker);
    });

  }, [visibleCases, zoomLevel, isPickerMode]);

  return (
    <div ref={mapWrapperRef} className="relative w-full h-full group bg-mystery-900">
      {loading ? (
        <div className="w-full h-full flex items-center justify-center bg-mystery-900">
          <div className="text-gray-400">Loading map...</div>
        </div>
      ) : (
        <>
          <div ref={mapContainerRef} className="w-full h-full z-0" />

          {/* Fullscreen Toggle Button */}
          <div className="absolute top-4 right-4 z-[500]">
            <button
              onClick={toggleFullscreen}
              className="bg-mystery-900/90 text-white p-2 rounded-lg border border-mystery-700 hover:bg-mystery-800 shadow-lg flex items-center gap-2 transition-colors"
              title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            >
              {isFullscreen ? (
                <Minimize className="w-4 h-4" />
              ) : (
                <Maximize className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Interactive Legend & Filters */}
          {!isPickerMode && (
            <div className="absolute top-4 left-4 z-[500]">
               <button 
                 onClick={() => setIsLegendOpen(!isLegendOpen)}
                 className="bg-mystery-900/90 text-white p-2 rounded-lg border border-mystery-700 hover:bg-mystery-800 mb-2 shadow-lg flex items-center gap-2"
               >
                 <Layers className="w-4 h-4" /> {isLegendOpen ? 'Hide' : 'Legend'}
               </button>

               <div className={`bg-mystery-900/95 backdrop-blur-md p-3 rounded-xl border border-mystery-700 shadow-2xl transition-all w-56 md:w-64 max-h-[70vh] overflow-y-auto ${isLegendOpen ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-full pointer-events-none'}`}>
                 <div className="flex justify-between items-center mb-3 gap-2">
                   <h3 className="font-bold text-white text-xs md:text-sm flex items-center gap-2">
                     <Layers className="w-4 h-4 text-mystery-accent" /> 
                     <span className="hidden sm:inline">Map Legend</span>
                   </h3>
                   <span className="text-xs text-gray-400 bg-mystery-800 px-2 py-0.5 rounded-full border border-mystery-700 whitespace-nowrap">
                     {visibleCases.length}
                   </span>
                 </div>

             <div className="space-y-1.5">
               {CATEGORIES.map(cat => (
                 <div key={cat} className="flex items-center justify-between cursor-pointer hover:bg-mystery-800/50 p-1.5 rounded transition-colors" onClick={() => toggleCategory(cat)}>
                   <div className="flex items-center gap-2 min-w-0">
                     <span 
                       className="w-3 h-3 rounded-full shadow-[0_0_5px] flex-shrink-0" 
                       style={{ 
                         backgroundColor: getCategoryColor(cat),
                         boxShadow: `0 0 5px ${getCategoryColor(cat)}`
                       }}
                     ></span>
                     <span className={`text-xs font-medium transition-colors truncate ${selectedCategories.has(cat) ? 'text-gray-200' : 'text-gray-600'}`}>
                       {cat.toUpperCase()}
                     </span>
                   </div>
                   <button className="text-gray-500 hover:text-white flex-shrink-0">
                      {selectedCategories.has(cat) ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                   </button>
                 </div>
               ))}
             </div>

             <div className="mt-3 pt-2 border-t border-mystery-700 hidden sm:block">
               <div className="text-[10px] text-gray-500 space-y-1">
                 <div>Zoom &lt; 5: Dots</div>
                 <div>Zoom &gt; 11: Cards</div>
               </div>
             </div>
           </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
