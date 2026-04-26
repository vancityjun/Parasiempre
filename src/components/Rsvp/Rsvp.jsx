import { useState } from "react";
import InputField from "./InputField";
import Select from "./Select";
import Questionnaire from "./Questionnaire";
import Button from "../Button";
import { useMemo } from "react";
import "./Rsvp.scss";
import RsvpConfirmation from "../RsvpConfirmation";
import questionnaireFlow from "./questionnaireFlow.json";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../firebase";

const submitStatus = {
  none: "none",
  submitting: "submitting",
  done: "done",
};

const Rsvp = () => {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [, setSubmitEnabled] = useState(false);
  const [email, setEmail] = useState("");
  const [guestCount, setGuestCount] = useState(0);
  const [submitState, setSubmitState] = useState(submitStatus);
  const [submissionError, setSubmissionError] = useState(null);
  const [recordId, setRecordId] = useState("");
  const questionState = useState(questionnaireFlow);
  const [answers, setAnswers] = useState({});

  const validateEmail = () => {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
  };

  const handleGuestCountChange = (event) => {
    setGuestCount(parseInt(event.target.value));
  };

  const validateFields = () => {
    return Boolean(firstName && lastName) && validateEmail();
  };

  const addRSVP = httpsCallable(functions, "addRSVP");

  const onClickSend = async () => {
    if (validateFields()) {
      setSubmitState(submitStatus.submitting);
      setSubmissionError(null);

      const dataToSend = {
        firstName,
        lastName,
        email,
        guestCount,
        questionnaireAnswers: answers,
        id: recordId,
      };

      try {
        const { data } = await addRSVP(dataToSend);
        console.log(data.message);
        setRecordId(data.id);
        setSubmitState(submitStatus.done);
      } catch (error) {
        console.error("Error adding document: ", error);
        setSubmissionError(
          `Failed to submit RSVP Please check your connection and try again.`,
        );
        setSubmitState(submitStatus.none);
      }
    }
  };

  const isSubmitting = useMemo(
    () => submitState === submitStatus.submitting,
    [submitState],
  );

  if (submitState === submitStatus.done) {
    return (
      <RsvpConfirmation
        email={email}
        firstName={firstName}
        lastName={lastName}
        answers={answers}
        changeAnswer={() => setSubmitState(submitStatus.none)}
      />
    );
  }

  return (
    <section className="rsvp">
      <h1>RSVP</h1>
      <InputField
        type="text"
        title={"First name"}
        isRequired
        val={firstName}
        setVal={setFirstName}
      />
      <InputField
        type="text"
        title={"Last name"}
        isRequired
        val={lastName}
        setVal={setLastName}
      />
      <InputField
        type="email"
        title={"Email"}
        isRequired
        setVal={setEmail}
        val={email}
      />
      <Select
        values={Array.from({ length: 10 }, (_, i) => i)}
        onChange={handleGuestCountChange}
      >
        How many guests <span className="bold">(excluding yourself)</span> will
        you be bringing?
      </Select>
      <Questionnaire
        setSubmitEnabled={setSubmitEnabled}
        setAnswers={setAnswers}
        answers={answers}
        questionState={questionState}
      />
      {submissionError && <p className="error">{submissionError}</p>}
      <Button
        // disabled={!submitEnabled || isSubmitting}
        disabled
        onClick={onClickSend}
        title={isSubmitting ? "Submitting..." : "Submit"}
      />
    </section>
  );
};

export default Rsvp;
