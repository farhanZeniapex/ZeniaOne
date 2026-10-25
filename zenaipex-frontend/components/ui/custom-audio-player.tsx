import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Download, Settings2 } from 'lucide-react';

interface CustomAudioPlayerProps {
  src: string;
}

export function CustomAudioPlayer({ src }: CustomAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);
    const onEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', onEnded);
    };
  }, []);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    audioRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return;
    const time = Number(e.target.value);
    audioRef.current.currentTime = time;
    setCurrentTime(time);
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const changeSpeed = (rate: number) => {
    if (!audioRef.current) return;
    audioRef.current.playbackRate = rate;
    setPlaybackRate(rate);
    setShowSpeedMenu(false);
  };

  return (
    <div className="w-full bg-white border border-gray-200 rounded-xl shadow-sm p-4 mt-2 transition-all">
      <audio ref={audioRef} src={src} autoPlay onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} />
      
      {/* Progress Bar */}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-xs font-medium text-gray-500 w-10 text-right">{formatTime(currentTime)}</span>
        <input 
          type="range" 
          min={0} 
          max={duration || 100} 
          value={currentTime}
          onChange={handleSeek}
          className="flex-1 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-sage-600 hover:accent-sage-700"
        />
        <span className="text-xs font-medium text-gray-500 w-10">{formatTime(duration)}</span>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button 
            onClick={togglePlay}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-sage-600 text-white hover:bg-sage-700 transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-sage-500"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-1" />}
          </button>
          
          <button 
            onClick={toggleMute}
            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 transition-colors"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>

        <div className="flex items-center gap-1 relative">
          <div className="relative">
            <button 
              onClick={() => setShowSpeedMenu(!showSpeedMenu)}
              className="text-xs font-semibold px-2 py-1.5 rounded text-gray-600 hover:bg-gray-100 flex items-center gap-1 transition-colors"
            >
              {playbackRate}x <Settings2 className="w-3 h-3" />
            </button>
            {showSpeedMenu && (
              <div className="absolute bottom-full right-0 mb-1 bg-white border border-gray-200 shadow-lg rounded-lg overflow-hidden py-1 z-10 w-24">
                {[1, 1.25, 1.5, 2].map(rate => (
                  <button 
                    key={rate}
                    onClick={() => changeSpeed(rate)}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 ${playbackRate === rate ? 'text-sage-600 font-bold bg-sage-50' : 'text-gray-700'}`}
                  >
                    {rate}x
                  </button>
                ))}
              </div>
            )}
          </div>
          
          <div className="w-px h-4 bg-gray-200 mx-1"></div>
          
          <a 
            href={src} 
            download="ZeniaOne_Recording.mp3"
            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-sage-600 transition-colors"
            title="Download Recording"
          >
            <Download className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  );
}
