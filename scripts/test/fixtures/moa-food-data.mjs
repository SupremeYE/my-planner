import {tables as base} from './moa-time-data.mjs';
export const tables=structuredClone(base);
export const oldPhoto='https://food.example.invalid/storage/v1/object/public/food-photos/legacy-original.jpg?keep=original';
tables.food_records=[
 {id:'old-breakfast',date:'2027-01-01',meal_type:'breakfast',food_name:'따뜻한 아침 한 그릇',amount:8500,photo_url:oldPhoto,memo:'천천히 즐긴 아침',calories:430,carbs:42,protein:20,fat:12,dining_type:'home',taste_rating:'good',taste_memo:'고소해서 좋았어요',is_fasting:false,legacy_extra:'keep'},
 {id:'shared-original',date:'2027-01-02',meal_type:'lunch',food_name:'다음 날의 같은 사진',amount:0,photo_url:oldPhoto,calories:null,is_fasting:false},
 {id:'no-photo',date:'2027-01-01',meal_type:'lunch',food_name:'사진 없이 남긴 점심',amount:0,photo_url:null,calories:null,is_fasting:false},
 {id:'broken-photo',date:'2027-01-01',meal_type:'dinner',food_name:'사진 연결을 확인할 저녁',amount:12000,photo_url:'https://food.example.invalid/storage/v1/object/public/food-photos/missing.jpg',calories:null,dining_type:'restaurant',taste_rating:'normal',is_fasting:false},
 {id:'old-fasting',date:'2026-12-31',meal_type:'breakfast',food_name:'단식',amount:0,photo_url:null,calories:0,is_fasting:true},
];
