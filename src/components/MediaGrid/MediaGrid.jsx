import { useState, useEffect, useRef } from "react";
import { functions } from "../../firebase";
import { httpsCallable } from "firebase/functions";
import "./MediaGrid.scss";
import Button from "../Button";
import { useNavigate } from "react-router";
import { useAuth } from "../../contexts/AuthContext";
import FullScreenMediaModal from "../FullScreenMediaModal/FullScreenMediaModal"; // Corrected import path

const listMediaPaginated = httpsCallable(functions, "listMediaPaginated");
const deleteMediaItemCallable = httpsCallable(functions, "deleteMediaItem");
const getMediaSettings = httpsCallable(functions, "getMediaSettings");
const ITEMS_PER_LOAD = 9;
const NATIVE_SAVE_BLOCKED = "blocked";
const GALLERY_IMAGE_SIZES =
  "(max-width: 600px) 33vw, (max-width: 1024px) 30vw, 220px";
const MODAL_IMAGE_SIZES = "100vw";

const MediaGridDisplay = ({
  isLoading,
  mediaItems,
  isVideo,
  allMediaLoaded,
  nextPageToken,
  isLoadingMore,
  onLoadMore,
  showDeleteControls,
  nativeSaveBlocked,
  onDelete,
  onMediaClick,
  onMediaReady,
  pendingDomItemNames,
}) => {
  if (isLoading && mediaItems.length === 0) {
    return (
      <div className="media-grid media-grid-loading" aria-label="Loading media">
        {Array.from({ length: ITEMS_PER_LOAD }).map((_, index) => (
          <div className="media-skeleton" key={index} />
        ))}
      </div>
    );
  }

  if (!isLoading && mediaItems.length === 0) {
    return (
      <div className="status-message no-media">No photos or videos found.</div>
    );
  }

  return (
    <>
      <div className="media-grid-shell">
        {(isLoading || isLoadingMore) && (
          <div className="media-grid-overlay" aria-live="polite">
            <div className="media-grid-spinner" />
          </div>
        )}
        <div className="media-grid">
          {mediaItems.map((item) => {
            const shouldPrioritizeLoading = pendingDomItemNames.includes(
              item.fullName,
            );

            return (
              <div
                key={item.fullName || item.name}
                className={`media-item ${
                  nativeSaveBlocked ? "prevent-save" : ""
                }`}
                onClick={() => onMediaClick(item)}
                onContextMenu={(e) => {
                  if (nativeSaveBlocked) e.preventDefault();
                }}
              >
                {isVideo(item.name) ? (
                  <video
                    src={item.url}
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload={shouldPrioritizeLoading ? "auto" : "metadata"}
                    draggable="false"
                    alt={`Video ${item.name}`}
                    title={
                      nativeSaveBlocked ? undefined : "Press and hold to download"
                    }
                    onLoadedData={() => onMediaReady(item.fullName)}
                    onError={() => onMediaReady(item.fullName)}
                  />
                ) : (
                  <img
                    src={item.thumbnailUrl || item.url}
                    srcSet={item.srcSet || undefined}
                    sizes={GALLERY_IMAGE_SIZES}
                    alt={`Photo ${item.name}`}
                    draggable="false"
                    loading={shouldPrioritizeLoading ? "eager" : "lazy"}
                    decoding="async"
                    title={
                      nativeSaveBlocked ? undefined : "Press and hold to download"
                    }
                    onLoad={() => onMediaReady(item.fullName)}
                    onError={() => onMediaReady(item.fullName)}
                  />
                )}
                {showDeleteControls && (
                  <button
                    className="delete-media-btn"
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent opening modal when deleting
                      onDelete(item.fullName);
                    }}
                    title="Delete Media"
                  >
                    &times;
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {!allMediaLoaded && nextPageToken && (
        <div className="load-more-container">
          <Button
            title={isLoadingMore ? "Loading..." : "Load More"}
            onClick={onLoadMore}
            disabled={isLoadingMore}
          />
        </div>
      )}
      {isLoadingMore && (
        <div className="status-message loading-more">Loading more...</div>
      )}
    </>
  );
};

const MediaGrid = ({ refreshKey }) => {
  const [mediaItems, setMediaItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [nextPageToken, setNextPageToken] = useState(null);
  const [allMediaLoaded, setAllMediaLoaded] = useState(false);
  const navigate = useNavigate();
  const { canWriteAdmin } = useAuth();
  const [currentModalIndex, setCurrentModalIndex] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [nativeSaveBlocked, setNativeSaveBlocked] = useState(true);
  const [pendingDomItemNames, setPendingDomItemNames] = useState([]);
  const preloadedModalImagesRef = useRef(new Set());
  const pendingRenderedItemsRef = useRef(new Set());
  const pendingRenderedPhaseRef = useRef(null);

  useEffect(() => {
    setMediaItems([]);
    setNextPageToken(null);
    setAllMediaLoaded(false);
    setPendingDomItemNames([]);
    preloadedModalImagesRef.current.clear();
    fetchMediaItems(true); // true for initial load
  }, [refreshKey]);

  useEffect(() => {
    const fetchMediaSettings = async () => {
      try {
        const result = await getMediaSettings();
        setNativeSaveBlocked(
          result.data.nativeSaveMode === NATIVE_SAVE_BLOCKED,
        );
      } catch (err) {
        console.error("Error fetching media settings:", err);
      }
    };

    fetchMediaSettings();
  }, []);

  const preloadModalImages = (items) => {
    if (typeof window === "undefined") return;

    const preload = () => {
      items.forEach((item) => {
        if (
          isVideo(item.name) ||
          preloadedModalImagesRef.current.has(item.fullName)
        ) {
          return;
        }

        const preloadSrc = item.thumbnailUrl || item.url;
        if (!preloadSrc) return;

        preloadedModalImagesRef.current.add(item.fullName);
        const image = new Image();
        image.decoding = "async";
        image.sizes = MODAL_IMAGE_SIZES;
        if (item.srcSet) image.srcset = item.srcSet;
        image.src = preloadSrc;
      });
    };

    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(preload, { timeout: 1500 });
    } else {
      window.setTimeout(preload, 0);
    }
  };

  const setLoadingState = (phase, value) => {
    if (phase === "initial") {
      setIsLoading(value);
      return;
    }

    if (phase === "more") {
      setIsLoadingMore(value);
    }
  };

  const beginPendingRenderedBatch = (items, phase) => {
    const pendingItems = items
      .filter((item) => item.fullName)
      .map((item) => item.fullName);

    pendingRenderedItemsRef.current = new Set(pendingItems);
    pendingRenderedPhaseRef.current = phase;
    setPendingDomItemNames(pendingItems);

    if (pendingItems.length === 0) {
      pendingRenderedPhaseRef.current = null;
      setPendingDomItemNames([]);
      setLoadingState(phase, false);
    }
  };

  const handleMediaReady = (fullName) => {
    if (!pendingRenderedItemsRef.current.has(fullName)) return;

    pendingRenderedItemsRef.current.delete(fullName);
    if (pendingRenderedItemsRef.current.size > 0) return;

    const phase = pendingRenderedPhaseRef.current;
    pendingRenderedPhaseRef.current = null;
    setPendingDomItemNames([]);
    if (phase) {
      setLoadingState(phase, false);
    }
  };

  const fetchMediaItems = async (
    isInitialLoad = false,
    tokenForNextPage = null,
  ) => {
    if (!isInitialLoad && isLoadingMore) return;
    if (allMediaLoaded && !isInitialLoad) return;

    if (isInitialLoad) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }

    try {
      const result = await listMediaPaginated({
        pageSize: ITEMS_PER_LOAD,
        pageToken: isInitialLoad ? null : tokenForNextPage,
      });

      const newItemsWithUrls = result.data.mediaItems;
      preloadModalImages(newItemsWithUrls);
      beginPendingRenderedBatch(
        newItemsWithUrls,
        isInitialLoad ? "initial" : "more",
      );

      setMediaItems((prevItems) =>
        isInitialLoad ? newItemsWithUrls : [...prevItems, ...newItemsWithUrls],
      );

      if (result.data.nextPageToken) {
        setNextPageToken(result.data.nextPageToken);
        setAllMediaLoaded(false);
      } else {
        setNextPageToken(null);
        setAllMediaLoaded(true);
      }
    } catch (err) {
      console.error("Error fetching media:", err);
      pendingRenderedItemsRef.current.clear();
      pendingRenderedPhaseRef.current = null;
      setPendingDomItemNames([]);
      setLoadingState(isInitialLoad ? "initial" : "more", false);
    }
  };

  const isVideo = (fileName) => {
    const videoExtensions = [".mp4", ".mov", ".webm", ".quicktime", ".mkv"];
    return videoExtensions.some((ext) => fileName.toLowerCase().endsWith(ext));
  };

  const handleDeleteMedia = async (fullName) => {
    if (!canWriteAdmin) return;

    // if (!window.confirm("Are you sure you want to delete this item?")) return;
    try {
      await deleteMediaItemCallable({ fullName });
      setMediaItems((prevItems) =>
        prevItems.filter((item) => item.fullName !== fullName),
      );
      console.log("Successfully deleted:", fullName);
    } catch (err) {
      console.error("Error deleting media:", err);
    }
  };

  const handleMediaClick = (mediaItem) => {
    const index = mediaItems.findIndex(
      (item) => item.fullName === mediaItem.fullName,
    );
    if (index !== -1) {
      setCurrentModalIndex(index);
      setIsModalOpen(true);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setCurrentModalIndex(null);
  };

  const handleNextMedia = () => {
    if (
      currentModalIndex !== null &&
      currentModalIndex < mediaItems.length - 1
    ) {
      setCurrentModalIndex(currentModalIndex + 1);
    }
  };

  const handlePrevMedia = () => {
    if (currentModalIndex !== null && currentModalIndex > 0) {
      setCurrentModalIndex(currentModalIndex - 1);
    }
  };

  return (
    <div className="media-grid-container">
      <h2>Gallery</h2>

      <MediaGridDisplay
        isLoading={isLoading}
        mediaItems={mediaItems}
        isVideo={isVideo}
        allMediaLoaded={allMediaLoaded}
        nextPageToken={nextPageToken}
        isLoadingMore={isLoadingMore}
        onLoadMore={() => fetchMediaItems(false, nextPageToken)}
        showDeleteControls={canWriteAdmin}
        nativeSaveBlocked={nativeSaveBlocked}
        onDelete={handleDeleteMedia}
        onMediaClick={handleMediaClick}
        onMediaReady={handleMediaReady}
        pendingDomItemNames={pendingDomItemNames}
      />
      <Button
        title="Share your media"
        onClick={() => {
          navigate("/upload");
        }}
        className="upload-button-spacing"
      />
      {isModalOpen && currentModalIndex !== null && mediaItems.length > 0 && (
        <FullScreenMediaModal
          mediaItems={mediaItems}
          currentIndex={currentModalIndex}
          onClose={handleCloseModal}
          onNext={handleNextMedia}
          onPrev={handlePrevMedia}
          isVideo={isVideo}
          canDownloadOriginal={!nativeSaveBlocked}
        />
      )}
    </div>
  );
};

export default MediaGrid;
