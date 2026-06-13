// 가고싶은 곳 공용 데이터 훅 — 보관함/지도 탭이 공유.
// place_* 4테이블을 한 번에 로드 + Realtime 구독(PC↔모바일 즉시 반영).
import { useCallback, useEffect, useState } from 'react';
import { db } from '../../../lib/db';
import type { Place, PlaceFolder } from '../../../lib/db';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';

export interface PlacesData {
  folders: PlaceFolder[];
  places: Place[];
  linkMap: Map<string, string[]>;   // placeId → folderId[]
  visitedIds: Set<string>;          // place_visits 가 가리키는 placeId
  loading: boolean;
  refresh: () => Promise<void>;
}

export function usePlacesData(): PlacesData {
  const [folders, setFolders] = useState<PlaceFolder[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [linkMap, setLinkMap] = useState<Map<string, string[]>>(new Map());
  const [visitedIds, setVisitedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [f, p, links, visits] = await Promise.all([
      db.placeFolders.fetchAll(),
      db.places.fetchAll(),
      db.placeFolderItems.allLinks(),
      db.placeVisits.fetchAll(),
    ]);
    setFolders(f);
    setPlaces(p);
    const m = new Map<string, string[]>();
    links.forEach(l => { const a = m.get(l.placeId) ?? []; a.push(l.folderId); m.set(l.placeId, a); });
    setLinkMap(m);
    setVisitedIds(new Set(visits.filter(v => v.placeId).map(v => v.placeId as string)));
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useRealtimeSync('place_folders', refresh);
  useRealtimeSync('places', refresh);
  useRealtimeSync('place_folder_items', refresh);
  useRealtimeSync('place_visits', refresh);

  return { folders, places, linkMap, visitedIds, loading, refresh };
}
