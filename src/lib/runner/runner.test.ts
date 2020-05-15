import { Conclusion, RuntimeStep, StepType } from "../runtimeModel";
import { Job, RunStep } from "../workflow";
import { run } from "./runner";

const defaultJob: Job = {
  "runs-on": "ubuntu-latest",
  steps: [
    {
      run: "echo Hello",
    },
  ],
};

describe("Runner", () => {
  it("with name", () => {
    const r = run({ event: "push" }, ".github/workflows/lesson.yaml", {
      name: "Lesson",
      on: "push",
      jobs: {},
    });

    expect(r.name).toBe("Lesson");
  });

  it("without name", () => {
    const r = run({ event: "push" }, ".github/workflows/lesson.yaml", {
      on: "push",
      jobs: {},
    });

    expect(r.name).toBe(".github/workflows/lesson.yaml");
  });

  it("without matching trigger", () => {
    const r = run({ event: "push" }, ".github/workflows/lesson.yaml", {
      on: [],
      jobs: {},
    });

    expect(r.jobs.length).toBe(0);
  });

  it("with matching trigger", () => {
    const r = run({ event: "push" }, ".github/workflows/lesson.yaml", {
      on: "push",
      jobs: {
        first: {
          "runs-on": "ubuntu-latest",
          steps: [
            {
              run: "echo 'Success'",
            },
          ],
        },
      },
    });

    expect(r.jobs.length).toBe(1);
    expect(r.jobs[0].name).toBe("first");
  });

  it("with matching trigger object notation", () => {
    const r = run({ event: "push" }, ".github/workflows/lesson.yaml", {
      on: {
        push: null,
      },
      jobs: {
        first: {
          "runs-on": "ubuntu-latest",
          steps: [
            {
              run: "echo 'Success'",
            },
          ],
        },
      },
    });

    expect(r.jobs.length).toBe(1);
    expect(r.jobs[0].name).toBe("first");
  });

  it("without activity", () => {
    const r = run(
      { event: "issues", action: "labeled" },
      ".github/workflows/lesson.yaml",
      {
        on: {
          issues: {},
        },
        jobs: {
          first: defaultJob,
        },
      }
    );

    expect(r.jobs.length).toBe(1);
  });

  it("without matching activity", () => {
    const r = run(
      { event: "issues", action: "labeled" },
      ".github/workflows/lesson.yaml",
      {
        on: {
          issues: {
            types: ["edited"],
          },
        },
        jobs: {
          first: defaultJob,
        },
      }
    );

    expect(r.jobs.length).toBe(0);
  });

  it("with expression name", () => {
    const r = run({ event: "push" }, ".github/workflows/lesson.yaml", {
      on: "push",
      jobs: {
        first: {
          name: "${{ github.event_name }}",
          "runs-on": "ubuntu-latest",
          steps: [
            {
              run: "echo 'Success'",
            },
          ],
        },
      },
    });

    expect(r.jobs.length).toBe(1);
    expect(r.jobs[0].name).toBe("push");
  });

  it("runs multiple jobs in random order", () => {
    const r = run({ event: "push" }, ".github/workflows/lesson.yaml", {
      on: "push",
      jobs: {
        first: {
          "runs-on": "ubuntu-latest",
          steps: [
            {
              run: "echo 'Success'",
            },
          ],
        },
        second: {
          "runs-on": "ubuntu-latest",
          steps: [
            {
              run: "echo 'Success'",
            },
          ],
        },
      },
    });

    expect(r.jobs.length).toBe(2);
    expect(r.jobs[0].name).toBe("first");
    expect(r.jobs[1].name).toBe("second");
  });

  it("runs multiple jobs in specified order", () => {
    const r = run({ event: "push" }, ".github/workflows/lesson.yaml", {
      on: "push",
      jobs: {
        second: {
          "runs-on": "ubuntu-latest",
          needs: "first",
          steps: [
            {
              run: "echo 'Success'",
            },
          ],
        },
        third: {
          "runs-on": "ubuntu-latest",
          steps: [
            {
              run: "echo 'Success'",
            },
          ],
          needs: ["first", "second"],
        },
        first: {
          "runs-on": "ubuntu-latest",
          steps: [
            {
              run: "echo 'Success'",
            },
          ],
        },
      },
    });

    expect(r.jobs.map((j) => j.name)).toEqual(["first", "second", "third"]);
    expect(r.jobs.map((j) => j.level)).toEqual([0, 1, 2]);
  });
});

describe("Jobs", () => {
  it("if", () => {
    const r = run({ event: "push" }, ".github/workflows/lesson.yaml", {
      on: "push",
      jobs: {
        first: {
          ...defaultJob,
          if: "true",
        },
      },
    });

    expect(r.jobs.length).toBe(1);
    expect(r.jobs[0].conclusion).toBe(Conclusion.Success);
  });

  it("matrix", () => {
    const r = run({ event: "push" }, ".github/workflows/lesson.yaml", {
      on: "push",
      jobs: {
        first: {
          ...defaultJob,
          strategy: {
            matrix: {
              foo: [1, 2, 3],
              bar: ["hello", "world"],
            },
          },
        },
      },
    });

    expect(r.jobs.length).toBe(1);
    expect(r.jobs[0].matrixJobs.length).toBe(6);
  });

  it("matrix expression", () => {
    const r = run({ event: "push" }, ".github/workflows/lesson.yaml", {
      on: "push",
      jobs: {
        first: {
          ...defaultJob,
          strategy: {
            matrix: {
              foo: [1, 2, 3],
              bar: ["hello", "world"],
            },
          },
          steps: [
            {
              run: "echo ${{ matrix.foo }}",
            },
          ],
        },
      },
    });

    expect(r.jobs.length).toBe(1);
    expect(r.jobs[0].matrixJobs.length).toBe(6);
    expect((r.jobs[0].matrixJobs[0].steps[0] as RunStep).run).toBe("echo 1");
  });

  it("matrix runs-on expression", () => {
    const r = run({ event: "push" }, ".github/workflows/lesson.yaml", {
      on: "push",
      jobs: {
        first: {
          ...defaultJob,
          strategy: {
            matrix: {
              os: ["ubuntu-latest", "windows-latest"],
            },
          },
          "runs-on": "${{ matrix.os }}",
          steps: [
            {
              run: "echo ${{ matrix.foo }}",
            },
          ],
        },
      },
    });

    expect(r.jobs.length).toBe(1);
    expect(r.jobs[0].matrixJobs[0].runnerLabel).toEqual(["ubuntu-latest"]);
    expect(r.jobs[0].matrixJobs[1].runnerLabel).toEqual(["windows-latest"]);
  });
});

describe("Paths filtering", () => {
  it("with matching path", () => {
    const r = run(
      { event: "push", files: ["a.png", "b/c.png"] },
      ".github/workflows/lesson.yaml",
      {
        on: {
          push: {
            paths: ["*"],
          },
        },
        jobs: {
          first: {
            "runs-on": "ubuntu-latest",
            steps: [
              {
                run: "echo 'Success'",
              },
            ],
          },
        },
      }
    );

    expect(r.jobs.length).toBe(1);
    expect(r.jobs[0].name).toBe("first");
  });

  it("without matching path", () => {
    const r = run(
      { event: "push", files: ["b/c.png"] },
      ".github/workflows/lesson.yaml",
      {
        on: {
          push: {
            paths: ["'*.png'"],
          },
        },
        jobs: {
          first: {
            "runs-on": "ubuntu-latest",
            steps: [
              {
                run: "echo 'Success'",
              },
            ],
          },
        },
      }
    );

    expect(r.jobs.length).toBe(0);
  });
});

describe("Branch filtering", () => {
  it("with matching branch", () => {
    const r = run(
      { event: "push", branch: "features/foo" },
      ".github/workflows/lesson.yaml",
      {
        on: {
          push: {
            branches: ["'features/*'"],
          },
        },
        jobs: {
          first: {
            "runs-on": "ubuntu-latest",
            steps: [
              {
                run: "echo 'Success'",
              },
            ],
          },
        },
      }
    );

    expect(r.jobs.length).toBe(1);
    expect(r.jobs[0].name).toBe("first");
  });
});

describe("Environment variables", () => {
  it("job name", () => {
    const r = run({ event: "push" }, ".github/workflows/lesson.yaml", {
      name: "Lesson",
      on: "push",
      env: {
        FOO: "Bar",
      },
      jobs: {
        build: {
          ...defaultJob,
          name: "${{ env.FOO }} ${{ env.JOB-FOO }}",
          env: {
            "JOB-FOO": "job-bar",
          },
        },
      },
    });

    expect(r.jobs[0].name).toBe("Bar job-bar");
  });
});

describe("Steps", () => {
  it("runs steps", () => {
    const r = run({ event: "push" }, ".github/workflows/lesson.yaml", {
      on: "push",
      jobs: {
        first: {
          "runs-on": "ubuntu-latest",
          steps: [
            {
              run: "echo 'Success'",
            },
            {
              uses: "actions/checkout@v2",
            },
          ],
        },
      },
    });

    expect(r.jobs[0].steps.length).toBe(2);
    expect(r.jobs[0].steps[0]).toEqual<RuntimeStep>({
      stepType: StepType.Run,
      run: "echo 'Success'",
      env: {},
    });
    expect(r.jobs[0].steps[1]).toEqual<RuntimeStep>({
      stepType: StepType.Uses,
      uses: "actions/checkout@v2",
      env: {},
    });
  });

  it("named steps", () => {
    const r = run({ event: "push" }, ".github/workflows/lesson.yaml", {
      on: "push",
      jobs: {
        first: {
          "runs-on": "ubuntu-latest",
          steps: [
            {
              name: "Hello",
              run: "echo 'Success'",
            },
            {
              name: "${{ github.event_name }}",
              uses: "actions/checkout@v2",
            },
          ],
        },
      },
    });

    expect(r.jobs[0].steps.length).toBe(2);
    expect(r.jobs[0].steps[0].name).toBe("Hello");
    expect(r.jobs[0].steps[1].name).toEqual("push");
  });

  it("run steps with expressions", () => {
    const r = run({ event: "push" }, ".github/workflows/lesson.yaml", {
      on: "push",
      env: {
        FOO: "bar",
        TEST: "baz",
      },
      jobs: {
        first: {
          "runs-on": "ubuntu-latest",
          steps: [
            {
              run: "./run.sh ${{ env.FOO}} ${{ env.TEST }}",
            },
          ],
        },
      },
    });

    expect(r.jobs[0].steps.length).toBe(1);
    expect("run" in r.jobs[0].steps[0] && r.jobs[0].steps[0].run).toBe(
      "./run.sh bar baz"
    );
  });
});
