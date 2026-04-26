import { useState, useEffect } from "react";
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

const MediaGridDisplay = ({
  isLoading,
  mediaItems,
  isVideo,
  allMediaLoaded,
  nextPageToken,
  isLoadingMore,
  onLoadMore,
  currentUser,
  onDelete,
  onMediaClick,
  nativeSaveBlocked,
}) => {
  if (isLoading && mediaItems.length === 0) {
    return <div className="status-message loading">Loading media...</div>;
  }

  if (!isLoading && mediaItems.length === 0) {
    return (
      <div className="status-message no-media">No photos or videos found.</div>
    );
  }

  return (
    <>
      <div className="media-grid">
        {mediaItems.map((item) => (
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
                draggable="false"
                alt={`Video ${item.name}`}
                title={
                  nativeSaveBlocked ? undefined : "Press and hold to download"
                }
              />
            ) : (
              <img
                src={item.url}
                alt={`Photo ${item.name}`}
                draggable="false"
                title={
                  nativeSaveBlocked ? undefined : "Press and hold to download"
                }
              />
            )}
            {currentUser && (
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
        ))}
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
  const { currentUser } = useAuth();
  const [currentModalIndex, setCurrentModalIndex] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [nativeSaveBlocked, setNativeSaveBlocked] = useState(true);

  useEffect(() => {
    setMediaItems([]);
    setNextPageToken(null);
    setAllMediaLoaded(false);
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
    } finally {
      if (isInitialLoad) {
        setIsLoading(false);
      } else {
        setIsLoadingMore(false);
      }
    }
  };

  const isVideo = (fileName) => {
    const videoExtensions = [".mp4", ".mov", ".webm", ".quicktime", ".mkv"];
    return videoExtensions.some((ext) => fileName.toLowerCase().endsWith(ext));
  };

  const handleDeleteMedia = async (fullName) => {
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
        currentUser={currentUser}
        onDelete={handleDeleteMedia}
        onMediaClick={handleMediaClick}
        nativeSaveBlocked={nativeSaveBlocked}
      />
      {!nativeSaveBlocked && (
        <p className="media-grid-instruction">
          Press and hold an image or video to download.
        </p>
      )}
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
          nativeSaveBlocked={nativeSaveBlocked}
        />
      )}
    </div>
  );
};

export default MediaGrid;
