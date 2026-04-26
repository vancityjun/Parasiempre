import { useEffect, useState, useRef } from "react";
import "./FullScreenMediaModal.scss";

const FullScreenMediaModal = ({
  mediaItems,
  currentIndex,
  onClose,
  onNext,
  onPrev,
  isVideo,
  nativeSaveBlocked = true,
}) => {
  const [touchStartX, setTouchStartX] = useState(0);
  const contentRef = useRef(null);

  const currentMedia = mediaItems[currentIndex];

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      } else if (event.key === "ArrowRight") {
        onNext();
      } else if (event.key === "ArrowLeft") {
        onPrev();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "auto";
    };
  }, [onClose, onNext, onPrev]);

  if (!currentMedia) {
    return null;
  }

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleTouchStart = (e) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e) => {
    if (touchStartX === 0) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diffX = touchEndX - touchStartX;
    const swipeThreshold = 50;

    if (diffX > swipeThreshold) {
      onPrev();
    } else if (diffX < -swipeThreshold) {
      onNext();
    }
    setTouchStartX(0);
  };

  return (
    <div
      className="fullscreen-modal-overlay"
      onClick={handleOverlayClick}
      onContextMenu={(e) => {
        if (nativeSaveBlocked) e.preventDefault();
      }}
    >
      <button className="close-modal-btn" onClick={onClose} title="Close">
        &times;
      </button>

      {currentIndex > 0 && (
        <button className="nav-btn prev-btn" onClick={onPrev} title="Previous">
          &#10094;
        </button>
      )}

      <div
        className="fullscreen-modal-content"
        ref={contentRef}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {isVideo(currentMedia.name) ? (
          <video
            src={currentMedia.url}
            controls
            controlsList={nativeSaveBlocked ? "nodownload" : undefined}
            autoPlay
            playsInline
            loop
            alt={`Video ${currentMedia.name}`}
            draggable="false"
            key={currentMedia.url}
          />
        ) : (
          <img
            src={currentMedia.url}
            alt={`Photo ${currentMedia.name}`}
            draggable="false"
            key={currentMedia.url}
          />
        )}
        {nativeSaveBlocked && !isVideo(currentMedia.name) && (
          <div className="fullscreen-save-blocker" />
        )}
      </div>

      {currentIndex < mediaItems.length - 1 && (
        <button className="nav-btn next-btn" onClick={onNext} title="Next">
          &#10095;
        </button>
      )}
    </div>
  );
};

export default FullScreenMediaModal;
