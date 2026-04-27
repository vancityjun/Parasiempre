import { useEffect, useState, useRef } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../firebase";
import "./FullScreenMediaModal.scss";

const createMediaDownloadUrl = httpsCallable(functions, "createMediaDownloadUrl");
const MODAL_IMAGE_SIZES = "100vw";

const FullScreenMediaModal = ({
  mediaItems,
  currentIndex,
  onClose,
  onNext,
  onPrev,
  isVideo,
  canDownloadOriginal = false,
}) => {
  const [touchStartX, setTouchStartX] = useState(0);
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const contentRef = useRef(null);

  const currentMedia = mediaItems[currentIndex];
  const isCurrentVideo = currentMedia ? isVideo(currentMedia.name) : false;

  useEffect(() => {
    setDownloadError("");
    setIsImageLoading(Boolean(currentMedia && !isCurrentVideo));
  }, [currentMedia, isCurrentVideo]);

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

  const handleDownload = async (event) => {
    event.stopPropagation();
    if (!canDownloadOriginal || isDownloading) return;

    try {
      setDownloadError("");
      setIsDownloading(true);
      const result = await createMediaDownloadUrl({
        fullName: currentMedia.fullName,
      });
      const link = document.createElement("a");
      link.href = result.data.url;
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error("Error creating download URL:", error);
      setDownloadError("Download failed. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

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
      onContextMenu={(e) => e.preventDefault()}
    >
      <button className="close-modal-btn" onClick={onClose} title="Close">
        &times;
      </button>

      {canDownloadOriginal && (
        <button
          className="download-media-btn"
          disabled={isDownloading}
          onClick={handleDownload}
          title="Download original"
        >
          {isDownloading ? "Preparing..." : "Download"}
        </button>
      )}

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
        {isCurrentVideo ? (
          <video
            src={currentMedia.url}
            controls
            controlsList="nodownload"
            autoPlay
            playsInline
            loop
            alt={`Video ${currentMedia.name}`}
            draggable="false"
            key={currentMedia.url}
          />
        ) : (
          <>
            {isImageLoading && (
              <div className="modal-media-loading">Loading photo...</div>
            )}
            <img
              src={currentMedia.thumbnailUrl || currentMedia.url}
              srcSet={currentMedia.srcSet || undefined}
              sizes={MODAL_IMAGE_SIZES}
              alt={`Photo ${currentMedia.name}`}
              draggable="false"
              loading="eager"
              decoding="async"
              key={currentMedia.fullName}
              onLoad={() => setIsImageLoading(false)}
              onError={() => setIsImageLoading(false)}
            />
          </>
        )}
        {!isCurrentVideo && <div className="fullscreen-save-blocker" />}
      </div>

      {downloadError && <p className="download-error">{downloadError}</p>}

      {currentIndex < mediaItems.length - 1 && (
        <button className="nav-btn next-btn" onClick={onNext} title="Next">
          &#10095;
        </button>
      )}
    </div>
  );
};

export default FullScreenMediaModal;
