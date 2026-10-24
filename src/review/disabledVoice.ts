// No permission prompt, MediaRecorder, external transcription or pretend success in Preview.
const noop=()=>{};
export function useVoiceInput(){return {status:'idle' as const,text:'',error:null,setText:noop,cancel:noop,startRecording:async()=>false,stopRecording:async()=>''};}
